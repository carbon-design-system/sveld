/**
 * Uses `@typescript/typescript6` because TypeScript 7's `typescript` package
 * no longer ships the classic Compiler API.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import ts from "@typescript/typescript6";

const ENTRY_TO_SUBPATH = {
  index: "sveld",
  browser: "sveld/browser",
} as const;

const TS_EXT_RE = /\.tsx?$/;
const DECL_EXT_RE = /\.(js|ts|d\.ts)$/;
const EXPORT_RE = /^export\b/;
const EXPORT_DEFAULT_RE = /^export\s+default\b/;
const EXPORT_DEFAULT_PREFIX_RE = /^export\s+default\s+/;
const EXPORT_PREFIX_RE = /^export\s+/;

export type EntryName = keyof typeof ENTRY_TO_SUBPATH;

export interface BundleDtsEntry {
  name: EntryName;
  source: string;
  outFile: string;
}

interface Decl {
  names: string[];
  text: string;
  node: ts.Statement;
  sourceFile: ts.SourceFile;
}

export async function bundleDts(opts: { root: string; entries: BundleDtsEntry[] }): Promise<void> {
  const { root, entries } = opts;
  const srcRoot = join(root, "src");
  const emitted = emitDeclarations(
    entries.map((e) => e.source),
    srcRoot,
  );

  const entryDtsByName = new Map<EntryName, string>();
  for (const entry of entries) {
    entryDtsByName.set(entry.name, sourceToDtsPath(entry.source, srcRoot, emitted));
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryDts = entryDtsByName.get(entry.name);
      if (!entryDts) throw new Error(`missing entry dts for ${entry.name}`);
      const text = rollupDts(entryDts, entry.name, emitted, entryDtsByName);
      await mkdir(dirname(entry.outFile), { recursive: true });
      await writeFile(entry.outFile, text.endsWith("\n") ? text : `${text}\n`);
    }),
  );
}

function emitDeclarations(rootNames: string[], srcRoot: string): Map<string, string> {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.esnext.d.ts"],
    strict: true,
    skipLibCheck: true,
    declaration: true,
    emitDeclarationOnly: true,
    resolveJsonModule: true,
    esModuleInterop: true,
    rootDir: srcRoot,
    // Match project ambient types so Node builtins resolve; avoid pulling
    // nothing (`types: []`) which breaks `node:` imports during emit.
    types: ["bun"],
  };

  const files = new Map<string, string>();
  const host = ts.createCompilerHost(options);
  host.writeFile = (fileName, text) => {
    files.set(norm(fileName), text);
  };

  const program = ts.createProgram({ rootNames, options, host });
  const result = program.emit(undefined, undefined, undefined, true);
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics].filter(
    (d) => d.category === ts.DiagnosticCategory.Error,
  );

  if (diagnostics.length || result.emitSkipped) {
    const msg = diagnostics
      .map((d) => {
        const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        if (!d.file || d.start === undefined) return text;
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        return `${d.file.fileName}:${line + 1}:${character + 1}: ${text}`;
      })
      .join("\n");
    throw new Error(`declaration emit failed:\n${msg}`);
  }

  return files;
}

function norm(p: string): string {
  return resolve(p).replaceAll("\\", "/");
}

function sourceToDtsPath(source: string, srcRoot: string, emitted: Map<string, string>): string {
  const rel = relative(srcRoot, source).replace(TS_EXT_RE, ".d.ts").replaceAll("\\", "/");
  for (const key of emitted.keys()) {
    if (key.endsWith(`/${rel}`) || key.endsWith(rel)) return key;
  }
  throw new Error(`no declaration emit for ${source} (expected …/${rel})\nhave: ${[...emitted.keys()].join("\n")}`);
}

function entryOfDtsPath(dtsPath: string, entryDtsByName: Map<EntryName, string>): EntryName | null {
  for (const [name, path] of entryDtsByName) {
    if (path === dtsPath) return name;
  }
  return null;
}

function rollupDts(
  entryDts: string,
  entryName: EntryName,
  emitted: Map<string, string>,
  entryDtsByName: Map<EntryName, string>,
): string {
  const reachable = new Set<string>();
  const externalLines = new Map<string, string>();

  const visit = (file: string) => {
    if (reachable.has(file)) return;
    reachable.add(file);
    const sf = parseDts(file, emitted);
    for (const stmt of sf.statements) {
      const spec = moduleSpecifierOf(stmt);
      if (spec) {
        if (!isRelative(spec)) {
          externalLines.set(stmt.getText(sf), stmt.getText(sf));
          continue;
        }

        let resolved: string;
        try {
          resolved = resolveDts(file, spec, emitted);
        } catch {
          externalLines.set(stmt.getText(sf), stmt.getText(sf));
          continue;
        }

        const resolvedEntry = entryOfDtsPath(resolved, entryDtsByName);
        if (resolvedEntry && resolvedEntry !== entryName) {
          const subpath = ENTRY_TO_SUBPATH[resolvedEntry];
          const rewritten = rewriteModuleSpecifier(stmt.getText(sf), spec, subpath);
          externalLines.set(rewritten, rewritten);
          continue;
        }
        visit(resolved);
        continue;
      }

      // Follow `import("./relative").Name` type queries embedded in declarations.
      for (const importSpec of collectImportTypeSpecs(stmt)) {
        if (!isRelative(importSpec)) continue;
        try {
          visit(resolveDts(file, importSpec, emitted));
        } catch {
          // Leave unresolved import() types for the rewrite pass / tsc.
        }
      }
    }
  };
  visit(entryDts);

  /** Decls keyed by file path, then local declared name (including `"default"`). */
  const declsByFileAndName = new Map<string, Map<string, Decl>>();
  /** Global name → decl for private helper type-ref chase (first wins; helpers are unique). */
  const declsByName = new Map<string, Decl>();
  const allDecls: Decl[] = [];

  for (const file of reachable) {
    const sf = parseDts(file, emitted);
    const byName = new Map<string, Decl>();
    declsByFileAndName.set(file, byName);

    for (const stmt of sf.statements) {
      if (moduleSpecifierOf(stmt)) continue;
      if (ts.isEmptyStatement(stmt)) continue;
      // `export {}` ambient marker — illegal once concatenated
      if (
        ts.isExportDeclaration(stmt) &&
        !stmt.moduleSpecifier &&
        stmt.exportClause &&
        ts.isNamedExports(stmt.exportClause) &&
        stmt.exportClause.elements.length === 0
      ) {
        continue;
      }

      const names = declaredNames(stmt);
      const text = stmt.getText(sf).trim();
      if (!text || text === "{}" || text === "export {}") continue;

      const decl: Decl = { names, text, node: stmt, sourceFile: sf };
      allDecls.push(decl);
      for (const n of names) {
        byName.set(n, decl);
        if (!declsByName.has(n)) declsByName.set(n, decl);
      }
    }
  }

  /** How each kept public decl should be exported in the rolled file. */
  const publicExportAs = new Map<Decl, Set<string>>();
  const kept = new Set<Decl>();

  const markPublic = (decl: Decl, exportAs: string) => {
    kept.add(decl);
    let aliases = publicExportAs.get(decl);
    if (!aliases) {
      aliases = new Set();
      publicExportAs.set(decl, aliases);
    }
    aliases.add(exportAs);
  };

  collectPublicBindings(entryDts, emitted, declsByFileAndName, markPublic);

  const queue: string[] = [];
  const seenName = new Set<string>();
  for (const decl of kept) {
    for (const ref of collectTypeRefs(decl.node)) queue.push(ref);
  }

  while (queue.length) {
    const name = queue.pop();
    if (name === undefined) break;
    if (seenName.has(name)) continue;
    seenName.add(name);
    const decl = declsByName.get(name);
    if (!decl || kept.has(decl)) continue;
    kept.add(decl);
    for (const ref of collectTypeRefs(decl.node)) queue.push(ref);
  }

  const chunks: string[] = [...externalLines.values()];

  for (const decl of allDecls) {
    if (!kept.has(decl)) continue;
    const aliases = publicExportAs.get(decl);
    if (!aliases) {
      let text = decl.text;
      if (EXPORT_DEFAULT_RE.test(text)) {
        text = text.replace(EXPORT_DEFAULT_PREFIX_RE, "declare ");
      } else if (EXPORT_RE.test(text)) {
        text = text.replace(EXPORT_PREFIX_RE, "");
      }
      chunks.push(rewriteInlineImportTypes(text));
      continue;
    }

    for (const alias of aliases) {
      chunks.push(rewriteInlineImportTypes(formatPublicDecl(decl, alias)));
    }
  }

  let output = `${chunks.join("\n\n")}\n`;
  // Node entry surfaces `NodeJS.Process` on `cli()`; point consumers at @types/node.
  if (entryName === "index") {
    output = `/// <reference types="node" />\n\n${output}`;
  }
  return output;
}

/**
 * Walk the entry's export surface and mark the concrete local declarations each
 * public name resolves to (handles `export { default as X }` without colliding
 * multiple module defaults into one `"default"` key).
 */
function collectPublicBindings(
  entryDts: string,
  emitted: Map<string, string>,
  declsByFileAndName: Map<string, Map<string, Decl>>,
  markPublic: (decl: Decl, exportAs: string) => void,
  stack = new Set<string>(),
): void {
  if (stack.has(entryDts)) return;
  stack.add(entryDts);

  const sf = parseDts(entryDts, emitted);

  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const publicName = el.name.text;
          const localName = el.propertyName ? el.propertyName.text : el.name.text;
          if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
            const spec = stmt.moduleSpecifier.text;
            if (!isRelative(spec)) continue;
            const resolved = resolveDts(entryDts, spec, emitted);
            const remote = resolveNameInFile(resolved, localName, emitted, declsByFileAndName);
            if (remote) markPublic(remote, publicName);
          } else {
            const decl = resolveNameInFile(entryDts, localName, emitted, declsByFileAndName);
            if (decl) markPublic(decl, publicName);
          }
        }
      } else if (!stmt.exportClause && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const spec = stmt.moduleSpecifier.text;
        if (isRelative(spec)) {
          collectPublicBindings(resolveDts(entryDts, spec, emitted), emitted, declsByFileAndName, markPublic, stack);
        }
      }
      continue;
    }

    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const decl = resolveNameInFile(entryDts, "default", emitted, declsByFileAndName);
      if (decl) markPublic(decl, "default");
      continue;
    }

    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      const decl = resolveNameInFile(entryDts, "default", emitted, declsByFileAndName);
      if (decl) markPublic(decl, "default");
    }
    for (const n of declaredNames(stmt)) {
      if (n === "default") continue;
      const decl = resolveNameInFile(entryDts, n, emitted, declsByFileAndName);
      if (decl) markPublic(decl, n);
    }
  }
}

/**
 * Resolve a binding name in a .d.ts file to its declaring Decl, following
 * `export { X } from "..."`, `export type { X }`, and `import type { X }` chains.
 */
function resolveNameInFile(
  file: string,
  name: string,
  emitted: Map<string, string>,
  declsByFileAndName: Map<string, Map<string, Decl>>,
  stack = new Set<string>(),
): Decl | undefined {
  const key = `${file}::${name}`;
  if (stack.has(key)) return undefined;
  stack.add(key);

  const direct = declsByFileAndName.get(file)?.get(name);
  if (direct) return direct;

  const sf = parseDts(file, emitted);
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text !== name) continue;
        const localName = el.propertyName ? el.propertyName.text : el.name.text;
        if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
          const spec = stmt.moduleSpecifier.text;
          if (!isRelative(spec)) return undefined;
          return resolveNameInFile(resolveDts(file, spec, emitted), localName, emitted, declsByFileAndName, stack);
        }
        // `export type { X }` — localName may only exist via an import.
        return resolveNameInFile(file, localName, emitted, declsByFileAndName, stack);
      }
    }

    if (ts.isImportDeclaration(stmt) && stmt.importClause && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      if (!isRelative(spec)) continue;
      const clause = stmt.importClause;
      if (clause.name?.text === name) {
        return resolveNameInFile(resolveDts(file, spec, emitted), "default", emitted, declsByFileAndName, stack);
      }
      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          if (el.name.text !== name) continue;
          const remoteName = el.propertyName ? el.propertyName.text : el.name.text;
          return resolveNameInFile(resolveDts(file, spec, emitted), remoteName, emitted, declsByFileAndName, stack);
        }
      }
    }
  }

  return undefined;
}

/** Emit a declaration with the correct `export` / `export default` shape for `alias`. */
function formatPublicDecl(decl: Decl, alias: string): string {
  let text = decl.text;

  if (alias === "default") {
    if (EXPORT_DEFAULT_RE.test(text)) return text;
    if (EXPORT_RE.test(text)) {
      return text.replace(EXPORT_PREFIX_RE, "export default ");
    }
    return `export default ${text}`;
  }

  // Named export — strip a default keyword if the source was `export default class Foo`.
  if (EXPORT_DEFAULT_RE.test(text)) {
    text = text.replace(EXPORT_DEFAULT_PREFIX_RE, "export ");
    // `export class Foo` already has the right local name when alias matches.
    if (decl.names.includes(alias)) return text;
    return `${text}\nexport { ${decl.names.find((n) => n !== "default") ?? alias} as ${alias} };`;
  }

  if (!EXPORT_RE.test(text)) {
    text = `export ${text}`;
  }

  if (decl.names.includes(alias) || decl.names.includes("default")) {
    return text;
  }

  const local = decl.names[0];
  if (local && local !== alias) {
    return `${text}\nexport { ${local} as ${alias} };`;
  }
  return text;
}

/** Collect type/value identifiers referenced in a declaration's type positions. */
function collectTypeRefs(node: ts.Node): Set<string> {
  const refs = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isTypeReferenceNode(n)) {
      refs.add(entityNameRoot(n.typeName));
    } else if (ts.isExpressionWithTypeArguments(n)) {
      if (ts.isIdentifier(n.expression)) refs.add(n.expression.text);
    } else if (ts.isTypeQueryNode(n)) {
      refs.add(entityNameRoot(n.exprName));
    } else if (ts.isComputedPropertyName(n) && ts.isIdentifier(n.expression)) {
      // e.g. `[brand]` / `[PARSED_COMPONENT_TYPE_SCRIPT_METADATA]?`
      refs.add(n.expression.text);
    } else if (ts.isImportTypeNode(n) && n.qualifier) {
      refs.add(entityNameRoot(n.qualifier));
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return refs;
}

/** Relative module specs appearing in `import("./x").Y` type queries. */
function collectImportTypeSpecs(node: ts.Node): string[] {
  const specs: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportTypeNode(n) && n.argument && ts.isLiteralTypeNode(n.argument)) {
      const lit = n.argument.literal;
      if (ts.isStringLiteral(lit)) specs.push(lit.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return specs;
}

/** After inlining, `import("./foo").Bar` should just be `Bar`. */
function rewriteInlineImportTypes(text: string): string {
  return text.replace(/import\("(\.[^"]+)"\)\.(\w+)/g, "$2");
}

function entityNameRoot(name: ts.EntityName): string {
  let n: ts.EntityName = name;
  while (ts.isQualifiedName(n)) n = n.left;
  return n.text;
}

function parseDts(file: string, emitted: Map<string, string>): ts.SourceFile {
  const text = emitted.get(file);
  if (text === undefined) throw new Error(`missing emit for ${file}`);
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

function isRelative(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../");
}

function moduleSpecifierOf(stmt: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
    return stmt.moduleSpecifier.text;
  }
  if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
    return stmt.moduleSpecifier.text;
  }
  return undefined;
}

function rewriteModuleSpecifier(text: string, fromSpec: string, toSpec: string): string {
  const escaped = fromSpec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(['"])${escaped}\\1`), `$1${toSpec}$1`);
}

function resolveDts(fromFile: string, spec: string, emitted: Map<string, string>): string {
  const bare = spec.replace(DECL_EXT_RE, "");
  const dir = dirname(fromFile);
  const candidates = [norm(join(dir, `${bare}.d.ts`)), norm(join(dir, bare, "index.d.ts"))];
  for (const c of candidates) {
    if (emitted.has(c)) return c;
  }
  for (const c of candidates) {
    const idx = c.lastIndexOf("/src/");
    const tail = idx >= 0 ? c.slice(idx + 1) : c.split("/").slice(-2).join("/");
    for (const key of emitted.keys()) {
      if (key.endsWith(tail) || key.endsWith(`/${tail}`)) return key;
    }
  }
  throw new Error(`cannot resolve "${spec}" from ${fromFile}\ntried: ${candidates.join(", ")}`);
}

function declaredNames(stmt: ts.Statement): string[] {
  const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
  const isDefault = !!mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

  if (
    ts.isFunctionDeclaration(stmt) ||
    ts.isClassDeclaration(stmt) ||
    ts.isInterfaceDeclaration(stmt) ||
    ts.isTypeAliasDeclaration(stmt) ||
    ts.isEnumDeclaration(stmt) ||
    ts.isModuleDeclaration(stmt)
  ) {
    const names: string[] = [];
    if (stmt.name) names.push(stmt.name.text);
    if (isDefault) names.push("default");
    return names;
  }
  if (ts.isVariableStatement(stmt)) {
    const out: string[] = [];
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) out.push(decl.name.text);
    }
    return out;
  }
  if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) return ["default"];
  return [];
}
