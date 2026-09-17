/**
 * `typesOptions.inline: "local"` bundle-level pass: copies `type`/`interface`
 * declarations imported from a relative source (or a tsconfig/jsconfig path
 * alias) directly into a component's `.d.ts`, so the generated file has no
 * relative imports left to resolve.
 *
 * Runs once per `generateBundle()` call, after every component has parsed.
 * Never mutates a component's cached `ParsedComponentTypeScriptMetadata`
 * (`typeImportStatements` / `localTypeDeclarations`) - the parse cache
 * persists that object to disk, and this pass's output depends on other
 * files' contents, not just the component's own source hash. Results live
 * entirely in the returned `Map`; the writer applies them (see
 * `writer-ts-definitions-core.ts`).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isIdentifier, isObject, resolveStaticStringLiteral } from "./ast-guards";
import type { ComponentDocApi, ComponentDocs, ResolveComponentFilePath } from "./bundle";
import { createDiagnostic } from "./diagnostics";
import { getParsedComponentTypeScriptMetadata } from "./parsed-component-metadata";
import { type WalkableNode, walkNodes } from "./parser/walk";
import { normalizeSeparators } from "./path";
import { resolveAliasLookup } from "./resolve-alias";
import type { BareTypeSession } from "./resolve-types";
import { parseProgram } from "./template-parse/acorn-bridge";
import { exportsTypeName, propsTypeName, type WriteTsDefinitionOptions } from "./writer/writer-ts-definitions-core";

/** Extensions probed, in order, for a resolved specifier with no extension of its own. */
const RESOLVE_EXTENSIONS = [".ts", ".d.ts", ".mts", ".cts"];
/** `index.*` candidates probed when a specifier resolves to a directory. */
const INDEX_SUFFIXES = ["/index.ts", "/index.d.ts"];
/** Bounds `export {} from` / `export *` chasing so a re-export cycle can't loop forever. */
const MAX_REEXPORT_DEPTH = 10;
/** Extracts the declared name from a `localTypeDeclarations` code string (e.g. `"interface Foo {"`). */
const DECL_NAME_REGEX = /^\s*(?:export\s+)?(?:declare\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/;

/**
 * Bare imports from exactly these sources always stay imports under `typesOptions.inline: "all"`,
 * never copied, even though the checker can resolve and copy them just fine: copying a framework
 * type would freeze whatever Svelte version happened to be installed at generation time into
 * every consumer's `.d.ts`, defeating the point of importing it from `svelte`/`svelte/elements`
 * in the first place. Checked against the exact import specifier string, not a resolved path, so
 * a project-local file that happens to be named "svelte.ts" is unaffected.
 */
const FRAMEWORK_BARE_ALLOWLIST: ReadonlySet<string> = new Set(["svelte", "svelte/elements"]);

function isFrameworkAllowlisted(source: string): boolean {
  return FRAMEWORK_BARE_ALLOWLIST.has(source);
}

export interface InlinedTypes {
  /** Exact `typeImportStatements` entries the writer must drop. */
  droppedImportStatements: string[];
  /** Declarations to emit (already stripped of `export`), in dependency order. */
  declarations: string[];
  /** Absolute paths of every file read, for watch-mode invalidation. */
  dependencies: string[];
}

interface ParsedFile {
  source: string;
  program: { body: WalkableNode[] };
}

/** One statement's attempt-then-commit transaction: everything added is rolled back together on failure. */
interface Transaction {
  orderStart: number;
  keys: string[];
}

/** State shared across every `typeImportStatements` entry of a single component. */
interface InlineContext {
  files: Map<string, ParsedFile | null>;
  /** Names already declared by the component itself; a copied declaration can't reuse one. */
  reservedNames: Set<string>;
  /** Declared name -> the `path#name` (or `alias#name`) key that owns it, for collision detection. */
  nameOwner: Map<string, string>;
  textByKey: Map<string, string>;
  /** Emission order, dependencies before dependents. */
  order: string[];
  /** Keys currently being resolved, breaking cycles between mutually-referencing declarations. */
  pending: Set<string>;
  dependencies: Set<string>;
  tx: Transaction;
  /**
   * `typesOptions.inline: "all"` only: a live checker session for resolving bare/package
   * imports. `undefined` under `"local"`, or under `"all"` when this component has no
   * non-allowlisted bare import to resolve in the first place.
   */
  bareSession: BareTypeSession | undefined;
  /** This component's bare-import overlay plan (see `planBareOverlay`), or `null` if it has none. */
  barePlan: BareOverlayPlan | null;
}

type Outcome = { ok: true } | { ok: false; reason: string };

type ModuleResolution =
  | { kind: "resolved"; path: string }
  | { kind: "svelte" }
  | { kind: "bare" }
  | { kind: "missing" };

/** Resolves an import specifier (relative, absolute, or a tsconfig/jsconfig path alias) to a file on disk. */
function resolveModuleSpecifier(source: string, fromAbsoluteFilePath: string): ModuleResolution {
  const fromDir = dirname(fromAbsoluteFilePath);
  let base: string;

  if (source.startsWith(".") || source.startsWith("/")) {
    base = resolve(fromDir, source);
  } else {
    const lookup = resolveAliasLookup(source, fromDir);
    if (lookup.unresolved) return { kind: "bare" };
    base = lookup.resolved;
  }

  if (existsSync(base) && statSync(base).isFile()) {
    return base.endsWith(".svelte") ? { kind: "svelte" } : { kind: "resolved", path: base };
  }
  if (existsSync(`${base}.svelte`)) return { kind: "svelte" };
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return { kind: "resolved", path: candidate };
  }
  for (const suffix of INDEX_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate)) return { kind: "resolved", path: candidate };
  }
  return { kind: "missing" };
}

function asNode(value: unknown): WalkableNode | undefined {
  return isObject(value) && typeof value.type === "string" ? (value as WalkableNode) : undefined;
}

function asNodeArray(value: unknown): WalkableNode[] {
  if (!Array.isArray(value)) return [];
  const nodes: WalkableNode[] = [];
  for (const item of value) {
    const node = asNode(item);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** `Identifier` name, or the string value of a `Literal` (a quoted export name). */
function nodeName(node: WalkableNode | undefined): string | undefined {
  if (!node) return undefined;
  if (isIdentifier(node)) return node.name;
  return resolveStaticStringLiteral(node) ?? undefined;
}

function sourceValueOf(node: WalkableNode | undefined): string | undefined {
  return resolveStaticStringLiteral(node) ?? undefined;
}

function getFile(ctx: InlineContext, filePath: string): ParsedFile | null {
  const cached = ctx.files.get(filePath);
  if (cached !== undefined) return cached;

  let file: ParsedFile | null;
  try {
    const source = readFileSync(filePath, "utf-8");
    const program = parseProgram(source, true, []) as unknown as { body: WalkableNode[] };
    file = { source, program };
  } catch {
    file = null;
  }
  ctx.files.set(filePath, file);
  return file;
}

/** `TSQualifiedName`'s left-most identifier, or an `Identifier`'s own name. */
function qualifiedRootName(node: WalkableNode | undefined): string | undefined {
  let current = node;
  while (current?.type === "TSQualifiedName") current = asNode(current.left);
  return current ? nodeName(current) : undefined;
}

/** Every distinct `TSTypeReference` root name in `node`'s body, excluding its own `id`/`typeParameters`. */
function collectTypeReferenceNames(node: WalkableNode): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const enter = (candidate: WalkableNode) => {
    if (candidate.type !== "TSTypeReference") return;
    const name = qualifiedRootName(asNode(candidate.typeName));
    if (name && !seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
  };

  for (const key in node) {
    if (key === "id" || key === "typeParameters") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const child = asNode(item);
        if (child) walkNodes(child, enter);
      }
    } else {
      const child = asNode(value);
      if (child) walkNodes(child, enter);
    }
  }

  return order;
}

/** The declaration's own generic parameter names - a reference to one is left alone, never chased. */
function collectTypeParamNames(node: WalkableNode): Set<string> {
  const names = new Set<string>();
  const typeParameters = asNode(node.typeParameters);
  for (const param of asNodeArray(typeParameters?.params)) {
    const name = nodeName(asNode(param.name));
    if (name) names.add(name);
  }
  return names;
}

type LocalDeclLookup = { kind: "type" | "interface"; node: WalkableNode } | { kind: "unsupported"; reason: string };

/** Finds a top-level declaration named `name` in `program`, exported or not. */
function findTopLevelDeclaration(program: { body: WalkableNode[] }, name: string): LocalDeclLookup | undefined {
  for (const stmt of program.body) {
    const inner = stmt.type === "ExportNamedDeclaration" ? (asNode(stmt.declaration) ?? stmt) : stmt;

    switch (inner.type) {
      case "TSTypeAliasDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "type", node: inner };
        break;
      case "TSInterfaceDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "interface", node: inner };
        break;
      case "TSEnumDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "unsupported", reason: "enum" };
        break;
      case "ClassDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "unsupported", reason: "class" };
        break;
      case "FunctionDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "unsupported", reason: "function" };
        break;
      case "TSModuleDeclaration":
        if (nodeName(asNode(inner.id)) === name) return { kind: "unsupported", reason: "namespace" };
        break;
      case "VariableDeclaration":
        for (const declarator of asNodeArray(inner.declarations)) {
          if (nodeName(asNode(declarator.id)) === name) return { kind: "unsupported", reason: "const" };
        }
        break;
      default:
        break;
    }
  }
  return undefined;
}

type ImportTarget =
  | { kind: "named"; source: string; importedName: string; localNameStart: number | undefined }
  | { kind: "namespace" };

/**
 * Finds how `localName` is bound by an `import` statement in `program`, if at all.
 *
 * `localNameStart` is the local-name identifier's character offset in the file `program` was
 * parsed from - a real, checker-visible position, used only by the `"all"` bare-import path to
 * ask the checker "what does this specifier resolve to" for a name reached while recursing
 * through an already-resolved real file (see `resolveBareReference`).
 */
function findImportedName(program: { body: WalkableNode[] }, localName: string): ImportTarget | undefined {
  for (const stmt of program.body) {
    if (stmt.type !== "ImportDeclaration") continue;
    const source = sourceValueOf(asNode(stmt.source));
    if (source === undefined) continue;

    for (const spec of asNodeArray(stmt.specifiers)) {
      const localNode = asNode(spec.local);
      const local = nodeName(localNode);
      if (local !== localName) continue;
      if (spec.type === "ImportNamespaceSpecifier") return { kind: "namespace" };
      const localNameStart = typeof localNode?.start === "number" ? localNode.start : undefined;
      if (spec.type === "ImportDefaultSpecifier") {
        return { kind: "named", source, importedName: "default", localNameStart };
      }
      if (spec.type === "ImportSpecifier") {
        return { kind: "named", source, importedName: nodeName(asNode(spec.imported)) ?? local, localNameStart };
      }
    }
  }
  return undefined;
}

/** One distinct bare specifier's imported name, deduplicated across a component's statements. */
interface BareEntrySpecifier {
  source: string;
  importedName: string;
}

/**
 * A component's bare-import overlay: a virtual `.ts` file that aliases and re-references every
 * distinct non-allowlisted bare-imported name from that component's own `typeImportStatements`,
 * so the checker has a real position to resolve each one from (a `.svelte` file's positions
 * aren't checker-visible).
 */
interface BareOverlayPlan {
  virtualFile: string;
  content: string;
  /** `${source}\0${importedName}` -> character offset of that name's reference in `content`. */
  positions: Map<string, number>;
}

function bareEntryKey(source: string, importedName: string): string {
  return `${source}\0${importedName}`;
}

/** Every distinct non-allowlisted bare specifier imported by a component's `typeImportStatements`. */
function collectBareEntrySpecifiers(statements: string[], componentAbsPath: string): BareEntrySpecifier[] {
  const seen = new Set<string>();
  const specifiers: BareEntrySpecifier[] = [];

  for (const statement of statements) {
    let program: { body: WalkableNode[] };
    try {
      program = parseProgram(statement, true, []) as unknown as { body: WalkableNode[] };
    } catch {
      continue;
    }

    for (const stmt of program.body) {
      if (stmt.type !== "ImportDeclaration") continue;
      const source = sourceValueOf(asNode(stmt.source));
      if (source === undefined || isFrameworkAllowlisted(source)) continue;
      if (resolveModuleSpecifier(source, componentAbsPath).kind !== "bare") continue;

      for (const spec of asNodeArray(stmt.specifiers)) {
        if (spec.type === "ImportNamespaceSpecifier") continue;
        const importedName =
          spec.type === "ImportDefaultSpecifier" ? "default" : (nodeName(asNode(spec.imported)) ?? undefined);
        if (!importedName) continue;

        const key = bareEntryKey(source, importedName);
        if (seen.has(key)) continue;
        seen.add(key);
        specifiers.push({ source, importedName });
      }
    }
  }

  return specifiers;
}

/**
 * The deterministic virtual overlay file path a component would get if it has a bare import to
 * resolve, whether or not it currently does - lets a caller (watch mode) find and forget a stale
 * overlay entry for a component that no longer has one, without needing to re-derive this naming.
 * Normalized to forward slashes: `resolve-types.ts`'s filesystem host normalizes every path before
 * checking its overlay map, so a raw `path.join` result (backslashes on Windows) would never match.
 */
export function bareOverlayVirtualFilePath(componentAbsPath: string, moduleName: string): string {
  return normalizeSeparators(join(dirname(componentAbsPath), `__sveld_inline_all_${moduleName}.ts`));
}

/**
 * Builds a component's bare-import overlay plan (see {@link BareOverlayPlan}), or `null` when it
 * has no non-allowlisted bare import to resolve. Pure and deterministic - safe to call twice (once
 * to build the up-front session overlay, once more per component while processing statements)
 * rather than threading state between the two.
 */
function planBareOverlay(componentAbsPath: string, moduleName: string, statements: string[]): BareOverlayPlan | null {
  const specifiers = collectBareEntrySpecifiers(statements, componentAbsPath);
  if (specifiers.length === 0) return null;

  const importLines = specifiers.map(
    ({ source, importedName }, index) =>
      `import type { ${importedName} as __sveld_bare_${index} } from ${JSON.stringify(source)};`,
  );

  const positions = new Map<string, number>();
  let content = `${importLines.join("\n")}\n`;
  specifiers.forEach(({ source, importedName }, index) => {
    content += `type __sveld_ref_${index} = `;
    positions.set(bareEntryKey(source, importedName), content.length);
    content += `__sveld_bare_${index};\n`;
  });

  const virtualFile = bareOverlayVirtualFilePath(componentAbsPath, moduleName);
  return { virtualFile, content, positions };
}

/**
 * Builds the overlay for every component's bare-import plan, for the caller to seed a
 * `BareTypeSession` with (`TypeResolver.openBareTypeSession`) before running
 * `inlineLocalTypeImports` with `typesInline: "all"`. Empty when no component has a
 * non-allowlisted bare import - callers use this to skip creating a `TypeResolver` entirely.
 */
export function collectBareImportOverlay(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
): Map<string, string> {
  const overlay = new Map<string, string>();

  for (const component of components.values()) {
    const statements = getParsedComponentTypeScriptMetadata(component)?.typeImportStatements ?? [];
    if (statements.length === 0) continue;

    const plan = planBareOverlay(resolveComponentFilePath(component.filePath), component.moduleName, statements);
    if (plan) overlay.set(plan.virtualFile, plan.content);
  }

  return overlay;
}

type ExportLookup =
  | { kind: "found"; node: WalkableNode; filePath: string; source: string }
  | { kind: "not-found" }
  | { kind: "unsupported"; reason: string };

/** Classifies a declaration node reached via an `export` statement (direct or default). */
function classifyExportedDeclaration(node: WalkableNode): { kind: "type" | "interface" } | { reason: string } {
  switch (node.type) {
    case "TSTypeAliasDeclaration":
      return { kind: "type" };
    case "TSInterfaceDeclaration":
      return { kind: "interface" };
    case "TSEnumDeclaration":
      return { reason: "enum" };
    case "ClassDeclaration":
      return { reason: "class" };
    case "FunctionDeclaration":
      return { reason: "function" };
    case "TSModuleDeclaration":
      return { reason: "namespace" };
    default:
      return { reason: node.type };
  }
}

/**
 * Finds the declaration that `name` refers to when exported from `filePath`, following
 * `export { X as Y } from` / `export * from` chains (depth-limited, cycle-safe via `visited`).
 */
function findExportedDeclaration(
  ctx: InlineContext,
  filePath: string,
  name: string,
  visited: Set<string>,
  depth: number,
): ExportLookup {
  const key = `${filePath}#${name}`;
  if (depth > MAX_REEXPORT_DEPTH || visited.has(key)) return { kind: "not-found" };
  visited.add(key);

  const file = getFile(ctx, filePath);
  if (!file) return { kind: "not-found" };
  // Recorded even for a file that only re-exports (never declares) the name: editing it to point
  // the re-export elsewhere must still invalidate a watch-mode cache of this result.
  ctx.dependencies.add(filePath);

  // 1. Direct: `export type X = ...` / `export interface X {}` / `export default interface X {}` / unsupported kinds.
  for (const stmt of file.program.body) {
    if (stmt.type === "ExportNamedDeclaration") {
      const decl = asNode(stmt.declaration);
      if (!decl) continue;
      if (decl.type === "VariableDeclaration") {
        for (const declarator of asNodeArray(decl.declarations)) {
          if (nodeName(asNode(declarator.id)) === name) return { kind: "unsupported", reason: "const" };
        }
        continue;
      }
      if (nodeName(asNode(decl.id)) !== name) continue;
      const classified = classifyExportedDeclaration(decl);
      return "reason" in classified
        ? { kind: "unsupported", reason: classified.reason }
        : { kind: "found", node: decl, filePath, source: file.source };
    }
    if (stmt.type === "ExportDefaultDeclaration" && name === "default") {
      const decl = asNode(stmt.declaration);
      if (!decl) return { kind: "not-found" };
      const classified = classifyExportedDeclaration(decl);
      return "reason" in classified
        ? { kind: "unsupported", reason: classified.reason }
        : { kind: "found", node: decl, filePath, source: file.source };
    }
  }

  // 2 & 3. `export { X }` / `export { Y as X }` (local) and `export { X as Y } from "./z"` (re-export).
  for (const stmt of file.program.body) {
    if (stmt.type !== "ExportNamedDeclaration" || stmt.declaration) continue;
    for (const spec of asNodeArray(stmt.specifiers)) {
      if (nodeName(asNode(spec.exported)) !== name) continue;
      const localName = nodeName(asNode(spec.local));
      if (!localName) return { kind: "not-found" };

      if (!stmt.source) {
        const found = findTopLevelDeclaration(file.program, localName);
        if (!found) return { kind: "not-found" };
        if (found.kind === "unsupported") return found;
        return { kind: "found", node: found.node, filePath, source: file.source };
      }

      const specifierValue = sourceValueOf(asNode(stmt.source));
      if (specifierValue === undefined) return { kind: "not-found" };
      const resolution = resolveModuleSpecifier(specifierValue, filePath);
      if (resolution.kind !== "resolved") return { kind: "not-found" };
      return findExportedDeclaration(ctx, resolution.path, localName, visited, depth + 1);
    }
  }

  // 4. `export * from "./z"` (a plain star; `export * as ns from` doesn't re-export names directly).
  for (const stmt of file.program.body) {
    if (stmt.type !== "ExportAllDeclaration" || asNode(stmt.exported)) continue;
    const specifierValue = sourceValueOf(asNode(stmt.source));
    if (specifierValue === undefined) continue;
    const resolution = resolveModuleSpecifier(specifierValue, filePath);
    if (resolution.kind !== "resolved") continue;
    const result = findExportedDeclaration(ctx, resolution.path, name, visited, depth + 1);
    if (result.kind !== "not-found") return result;
  }

  return { kind: "not-found" };
}

/** Registers `wantedLocalName` as an alias of `declaredName` when they differ, collision-checked like any other name. */
function applyAlias(ctx: InlineContext, declaredName: string, wantedLocalName: string): Outcome {
  if (wantedLocalName === declaredName) return { ok: true };

  const aliasKey = `alias#${wantedLocalName}`;
  if (ctx.textByKey.has(aliasKey)) return { ok: true };

  const owner = ctx.nameOwner.get(wantedLocalName);
  if (owner !== undefined && owner !== aliasKey) {
    return { ok: false, reason: `"${wantedLocalName}" was already inlined from a different source` };
  }
  if (ctx.reservedNames.has(wantedLocalName)) {
    return { ok: false, reason: `"${wantedLocalName}" collides with an existing declaration in the component` };
  }

  ctx.nameOwner.set(wantedLocalName, aliasKey);
  ctx.tx.keys.push(aliasKey);
  ctx.textByKey.set(aliasKey, `type ${wantedLocalName} = ${declaredName};`);
  ctx.order.push(aliasKey);
  return { ok: true };
}

/** What resolving a bare reference through the checker (see `resolveBareReference`) landed on. */
type BareReferenceOutcome =
  | { status: "found"; node: WalkableNode; filePath: string; source: string }
  | { status: "left-alone" }
  | { status: "unresolved" }
  | { status: "unlocatable"; filePath: string; declaredName: string }
  | { status: "unsupported"; reason: string };

/**
 * Resolves the bare/package specifier at `position` in `file` through `ctx.bareSession`, then
 * classifies the result exactly like any other file this pass reads - same unsupported-kind
 * rules as the local pass.
 *
 * Only called where `ctx.bareSession` is already known to be set (`"all"` mode, at least one
 * non-allowlisted bare specifier found somewhere in the bundle).
 */
async function resolveBareReference(ctx: InlineContext, file: string, position: number): Promise<BareReferenceOutcome> {
  // biome-ignore lint/style/noNonNullAssertion: only called by call sites that already checked ctx.bareSession.
  const resolution = await ctx.bareSession!.resolveAt(file, position);
  if (resolution.kind === "default-lib") return { status: "left-alone" };
  if (resolution.kind === "unresolved") return { status: "unresolved" };

  const target = getFile(ctx, resolution.filePath);
  if (!target) return { status: "unlocatable", filePath: resolution.filePath, declaredName: resolution.declaredName };

  const found = findTopLevelDeclaration(target.program, resolution.declaredName);
  if (!found) return { status: "unlocatable", filePath: resolution.filePath, declaredName: resolution.declaredName };
  if (found.kind === "unsupported") return { status: "unsupported", reason: found.reason };

  return { status: "found", node: found.node, filePath: resolution.filePath, source: target.source };
}

/**
 * Copies `node` (a `type`/`interface` declaration from `filePath`) and every same-file or
 * imported declaration it references, then registers `wantedLocalName` as an alias if the
 * caller's local name differs from the declaration's own name.
 */
async function emitDeclaration(
  ctx: InlineContext,
  node: WalkableNode,
  filePath: string,
  source: string,
  wantedLocalName: string,
): Promise<Outcome> {
  const declaredName = nodeName(asNode(node.id));
  const start = node.start;
  const end = node.end;
  if (!declaredName || typeof start !== "number" || typeof end !== "number") {
    return { ok: false, reason: "has no name or source position" };
  }

  const realKey = `${filePath}#${declaredName}`;
  if (ctx.pending.has(realKey) || ctx.textByKey.has(realKey)) {
    return applyAlias(ctx, declaredName, wantedLocalName);
  }

  const owner = ctx.nameOwner.get(declaredName);
  if (owner !== undefined && owner !== realKey) {
    return { ok: false, reason: `"${declaredName}" was already inlined from a different source` };
  }
  if (ctx.reservedNames.has(declaredName)) {
    return { ok: false, reason: `"${declaredName}" collides with an existing declaration in the component` };
  }

  ctx.pending.add(realKey);
  ctx.nameOwner.set(declaredName, realKey);
  ctx.tx.keys.push(realKey);
  ctx.dependencies.add(filePath);

  const typeParamNames = collectTypeParamNames(node);
  const file = getFile(ctx, filePath);

  // Sequential by necessity: each reference's outcome (a name reservation, a pending-set entry)
  // is visible to the next reference's collision/cycle checks, and a failure must roll back only
  // what this declaration itself added so far.
  for (const refName of collectTypeReferenceNames(node)) {
    if (typeParamNames.has(refName) || refName === declaredName) continue;
    if (!file) continue;

    const local = findTopLevelDeclaration(file.program, refName);
    if (local) {
      if (local.kind === "unsupported") {
        ctx.pending.delete(realKey);
        return { ok: false, reason: `references "${refName}", a ${local.reason} that cannot be inlined` };
      }
      // biome-ignore lint/performance/noAwaitInLoops: shared, order-dependent ctx state (see above the loop).
      const result = await emitDeclaration(ctx, local.node, filePath, source, refName);
      if (!result.ok) {
        ctx.pending.delete(realKey);
        return result;
      }
      continue;
    }

    const importTarget = findImportedName(file.program, refName);
    if (!importTarget || importTarget.kind === "namespace") continue; // assume a global, or an out-of-scope namespace import.

    const resolution = resolveModuleSpecifier(importTarget.source, filePath);
    if (resolution.kind === "resolved") {
      const found = findExportedDeclaration(ctx, resolution.path, importTarget.importedName, new Set(), 0);
      if (found.kind === "not-found") {
        ctx.pending.delete(realKey);
        return { ok: false, reason: `references "${refName}", which is not exported from "${importTarget.source}"` };
      }
      if (found.kind === "unsupported") {
        ctx.pending.delete(realKey);
        return { ok: false, reason: `references "${refName}", a ${found.reason} that cannot be inlined` };
      }
      const result = await emitDeclaration(ctx, found.node, found.filePath, found.source, refName);
      if (!result.ok) {
        ctx.pending.delete(realKey);
        return result;
      }
      continue;
    }

    if (
      resolution.kind !== "bare" ||
      isFrameworkAllowlisted(importTarget.source) ||
      !ctx.bareSession ||
      importTarget.localNameStart === undefined
    ) {
      // missing/.svelte, the svelte/svelte-elements allow-list, no checker session (`"local"`, or
      // `"all"` with nothing bare anywhere else), or no real position to query: assume a global,
      // leave alone - same "leave alone" contract a bare reference has always had.
      continue;
    }

    const resolved = await resolveBareReference(ctx, filePath, importTarget.localNameStart);
    if (resolved.status === "left-alone") continue; // an ambient (TypeScript default-lib) global.
    if (resolved.status !== "found") {
      ctx.pending.delete(realKey);
      const reason =
        resolved.status === "unresolved"
          ? `which could not be resolved from "${importTarget.source}"`
          : resolved.status === "unlocatable"
            ? `which resolves to "${resolved.declaredName}" in "${resolved.filePath}", where sveld could not locate that declaration`
            : `a ${resolved.reason} that cannot be inlined`;
      return { ok: false, reason: `references "${refName}", ${reason}` };
    }
    const result = await emitDeclaration(ctx, resolved.node, resolved.filePath, resolved.source, refName);
    if (!result.ok) {
      ctx.pending.delete(realKey);
      return result;
    }
  }

  ctx.pending.delete(realKey);
  ctx.textByKey.set(realKey, source.slice(start, end).trim());
  ctx.order.push(realKey);

  return applyAlias(ctx, declaredName, wantedLocalName);
}

/** Top-level entry: `name` must be exported from `filePath` (an actual `import` requires this). */
async function inlineImportedName(
  ctx: InlineContext,
  filePath: string,
  name: string,
  wantedLocalName: string,
): Promise<Outcome> {
  const found = findExportedDeclaration(ctx, filePath, name, new Set(), 0);
  if (found.kind === "not-found") return { ok: false, reason: `"${name}" is not exported from "${filePath}"` };
  if (found.kind === "unsupported") {
    return { ok: false, reason: `"${name}" is a ${found.reason}, which cannot be inlined` };
  }
  return emitDeclaration(ctx, found.node, found.filePath, found.source, wantedLocalName);
}

/**
 * Top-level entry for a bare/package specifier under `typesOptions.inline: "all"`: looks up
 * `source`+`importedName`'s pre-computed position in `ctx.barePlan` (built once per component by
 * `planBareOverlay`) and resolves it through the checker.
 */
async function inlineBareImportedName(
  ctx: InlineContext,
  source: string,
  importedName: string,
  wantedLocalName: string,
): Promise<Outcome> {
  const position = ctx.barePlan?.positions.get(bareEntryKey(source, importedName));
  if (!ctx.bareSession || !ctx.barePlan || position === undefined) {
    return { ok: false, reason: `"${importedName}" is a package import that sveld could not verify` };
  }

  const resolved = await resolveBareReference(ctx, ctx.barePlan.virtualFile, position);
  switch (resolved.status) {
    case "left-alone":
      return { ok: false, reason: `"${importedName}" resolves to a built-in TypeScript type, which cannot be inlined` };
    case "unresolved":
      return { ok: false, reason: `"${importedName}" could not be resolved from "${source}"` };
    case "unlocatable":
      return {
        ok: false,
        reason: `"${importedName}" resolves to "${resolved.declaredName}" in "${resolved.filePath}", where sveld could not locate that declaration`,
      };
    case "unsupported":
      return { ok: false, reason: `"${importedName}" is a ${resolved.reason}, which cannot be inlined` };
    case "found":
      return emitDeclaration(ctx, resolved.node, resolved.filePath, resolved.source, wantedLocalName);
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

function rollback(ctx: InlineContext): void {
  ctx.order.length = ctx.tx.orderStart;
  const keys = new Set(ctx.tx.keys);
  for (const key of keys) ctx.textByKey.delete(key);
  for (const [declaredName, ownerKey] of ctx.nameOwner) {
    if (keys.has(ownerKey)) ctx.nameOwner.delete(declaredName);
  }
}

interface StatementFailure {
  name: string;
  reason: string;
}

type StatementOutcome =
  | { status: "inlined" }
  | { status: "kept" }
  | { status: "refused"; failures: StatementFailure[] };

/** Attempts to inline every name of one `typeImportStatements` entry, atomically (all or nothing). */
async function processStatement(
  ctx: InlineContext,
  statement: string,
  componentAbsPath: string,
): Promise<StatementOutcome> {
  let program: { body: WalkableNode[] };
  try {
    program = parseProgram(statement, true, []) as unknown as { body: WalkableNode[] };
  } catch {
    return { status: "kept" };
  }

  const importDecls = program.body.filter((stmt) => stmt.type === "ImportDeclaration");
  if (importDecls.length === 0) return { status: "kept" };

  const specifierPairs = importDecls.flatMap((decl) => asNodeArray(decl.specifiers).map((spec) => ({ decl, spec })));
  if (specifierPairs.some(({ spec }) => spec.type === "ImportNamespaceSpecifier")) return { status: "kept" };

  const sourceValue = sourceValueOf(asNode(importDecls[0]?.source));
  if (sourceValue === undefined) return { status: "kept" };

  const resolution = resolveModuleSpecifier(sourceValue, componentAbsPath);
  if (resolution.kind === "svelte") return { status: "kept" };

  const names: Array<{ importedName: string; localName: string }> = [];
  for (const { spec } of specifierPairs) {
    const localName = nodeName(asNode(spec.local));
    if (!localName) continue;
    const importedName =
      spec.type === "ImportDefaultSpecifier" ? "default" : (nodeName(asNode(spec.imported)) ?? localName);
    names.push({ importedName, localName });
  }

  if (resolution.kind === "missing") {
    return {
      status: "refused",
      failures: names.map(({ localName }) => ({ name: localName, reason: `"${sourceValue}" was not found on disk` })),
    };
  }

  if (resolution.kind === "bare") {
    // Never attempted under `"local"`, for the svelte/svelte-elements allow-list, or when no
    // checker session exists (e.g. `"all"` found nothing bare anywhere else in the bundle and
    // skipped creating one): kept exactly as sveld has always kept a bare import, no diagnostic.
    if (isFrameworkAllowlisted(sourceValue) || !ctx.bareSession) return { status: "kept" };

    ctx.tx = { orderStart: ctx.order.length, keys: [] };
    const bareFailures: StatementFailure[] = [];
    // Sequential by necessity: each name's collision check depends on ctx state a prior name in
    // the same statement may have just reserved (rolled back together below on any failure).
    for (const { importedName, localName } of names) {
      // biome-ignore lint/performance/noAwaitInLoops: shared, order-dependent ctx state (see above the loop).
      const outcome = await inlineBareImportedName(ctx, sourceValue, importedName, localName);
      if (!outcome.ok) bareFailures.push({ name: localName, reason: outcome.reason });
    }

    if (bareFailures.length > 0) {
      rollback(ctx);
      return { status: "refused", failures: bareFailures };
    }
    return { status: "inlined" };
  }

  ctx.tx = { orderStart: ctx.order.length, keys: [] };
  const failures: StatementFailure[] = [];
  // Sequential by necessity, same as the bare-import loop above.
  for (const { importedName, localName } of names) {
    // biome-ignore lint/performance/noAwaitInLoops: shared, order-dependent ctx state (see above the loop).
    const outcome = await inlineImportedName(ctx, resolution.path, importedName, localName);
    if (!outcome.ok) failures.push({ name: localName, reason: outcome.reason });
  }

  if (failures.length > 0) {
    rollback(ctx);
    return { status: "refused", failures };
  }
  return { status: "inlined" };
}

/** Names the component itself already declares; a copied declaration can't reuse one of these. */
function collectComponentReservedNames(
  component: ComponentDocApi,
  typeNames: WriteTsDefinitionOptions["typeNames"] | undefined,
): Set<string> {
  const names = new Set<string>();
  for (const typedef of component.typedefs) names.add(typedef.name);
  for (const context of component.contexts ?? []) names.add(context.typeName);

  const metadata = getParsedComponentTypeScriptMetadata(component);
  for (const declaration of metadata?.localTypeDeclarations ?? []) {
    const match = DECL_NAME_REGEX.exec(declaration);
    if (match) names.add(match[1]);
  }

  names.add(propsTypeName(component.moduleName, typeNames));
  names.add(exportsTypeName(component.moduleName, typeNames));
  return names;
}

/**
 * Copies relative (and tsconfig/jsconfig-alias) type imports into each component's `.d.ts`,
 * dropping the import in favor of the copied declaration. `.svelte` sources and namespace
 * imports are left as imports untouched, as are bare/package imports unless `bareSession` is
 * given (`typesOptions.inline: "all"`, and this bundle has at least one non-allowlisted bare
 * import to attempt - see `collectBareImportOverlay`), in which case those are attempted through
 * the checker too, except for the svelte/svelte-elements allow-list, which always stays an
 * import. An import that can't be safely inlined (missing file, missing export, an unsupported
 * export kind, a name collision, or - `"all"` only - a bare specifier the checker couldn't
 * resolve) stays an import too, with a `types-inline-unresolved` diagnostic explaining why.
 *
 * Never mutates `typeImportStatements`/`localTypeDeclarations` - see the module doc comment.
 * Idempotent: previous `types-inline-unresolved` diagnostics are replaced, not accumulated.
 */
export async function inlineLocalTypeImports(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
  typeNames?: WriteTsDefinitionOptions["typeNames"],
  bareSession?: BareTypeSession,
): Promise<Map<string, InlinedTypes>> {
  const result = new Map<string, InlinedTypes>();

  // Each component gets its own InlineContext with no state shared across components, so this
  // runs concurrently rather than needing a sequential for...of.
  await Promise.all(
    Array.from(components.values()).map(async (component) => {
      const metadata = getParsedComponentTypeScriptMetadata(component);
      const typeImportStatements = metadata?.typeImportStatements ?? [];
      if (typeImportStatements.length === 0) return;

      const componentAbsPath = resolveComponentFilePath(component.filePath);
      const barePlan = bareSession
        ? planBareOverlay(componentAbsPath, component.moduleName, typeImportStatements)
        : null;

      const ctx: InlineContext = {
        files: new Map(),
        reservedNames: collectComponentReservedNames(component, typeNames),
        nameOwner: new Map(),
        textByKey: new Map(),
        order: [],
        pending: new Set(),
        dependencies: new Set(),
        tx: { orderStart: 0, keys: [] },
        bareSession,
        barePlan,
      };

      const droppedImportStatements: string[] = [];
      // Idempotent: drop any diagnostics from a previous run of this pass on the same component
      // (e.g. a prior watch-mode flush) before adding this run's.
      const diagnostics = (component.diagnostics ?? []).filter((d) => d.kind !== "types-inline-unresolved");

      // Sequential by necessity: statements share `ctx` (name reservations, emission order), so
      // processing order determines dedup/collision outcomes and must stay stable.
      for (const statement of typeImportStatements) {
        // biome-ignore lint/performance/noAwaitInLoops: shared, order-dependent ctx state (see above the loop).
        const outcome = await processStatement(ctx, statement, componentAbsPath);
        if (outcome.status === "inlined") {
          droppedImportStatements.push(statement);
        } else if (outcome.status === "refused") {
          for (const failure of outcome.failures) {
            diagnostics.push(
              createDiagnostic({
                component: component.filePath,
                kind: "types-inline-unresolved",
                name: failure.name,
                message: `Cannot inline "${failure.name}": ${failure.reason}.`,
              }),
            );
          }
        }
      }

      component.diagnostics = diagnostics;

      if (droppedImportStatements.length === 0 && ctx.order.length === 0) return;

      result.set(component.filePath, {
        droppedImportStatements,
        declarations: ctx.order.map((key) => ctx.textByKey.get(key) ?? ""),
        dependencies: Array.from(ctx.dependencies),
      });
    }),
  );

  return result;
}
