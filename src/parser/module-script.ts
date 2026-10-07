/**
 * Parse phase 2: the `<script context="module">` walk, which records the
 * module's exports and the imports, functions, and variables the instance
 * script can see.
 */
import type { ClassDeclaration, ExportNamedDeclaration, Node } from "sveast";
import { walk } from "sveast/walk";
import type { ComponentProp, ComponentPropReExport } from "../model";
import { readClassDeclaration } from "./classes";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import {
  collectExportDeclarators,
  exportJSDoc,
  moduleExportName,
  type ResolvedExportSpecifier,
  recordUnresolvedExportSpecifier,
  resolveExportDeclaratorTypeAndDocs,
  resolveExportSpecifier,
} from "./exports";
import { processNodeJSDoc } from "./jsdoc";
import { sourceRangeFromNode } from "./source-position";
import { collectReExportableImports, collectValueImportBindings } from "./value-imports";

/** The bare base-class name in an `extends` clause: `Base` in `Base<T>`; none for `mixin(Base)` or `ns.Base`. */
const CLASS_BASE_NAME_REGEX = /^[A-Za-z_$][\w$]*(?=\s*(?:<|$))/;

function addModuleExport(ctx: ParserContext, prop_name: string, data: ComponentProp) {
  if (!prop_name) return;
  const existing = ctx.moduleExports.get(prop_name);
  ctx.moduleExports.set(prop_name, existing ? { ...existing, ...data } : data);
}

/** Records an `export ... from` (or `export { imported }`) as-is; the `.d.ts` writer emits it verbatim. */
function addModuleReExport(ctx: ParserContext, node: Node, name: string, reExport: ComponentPropReExport) {
  const jsdocInfo = processNodeJSDoc(ctx, node);
  // Each `export * from` shares the name "*", so key those by source instead.
  addModuleExport(ctx, name === "*" ? `* from ${reExport.from}` : name, {
    name,
    kind: "re-export",
    description: jsdocInfo?.description,
    deprecated: jsdocInfo?.deprecated,
    tags: jsdocInfo?.tags,
    ...(jsdocInfo?.internal ? { internal: true as const } : {}),
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: false,
    constant: false,
    reactive: false,
    reExport,
    source: sourceRangeFromNode(ctx, node),
  });
}

/** `export { x as default }` / `export * as default from "..."` collide with the component itself. */
function recordDefaultExportConflict(ctx: ParserContext, node: Node) {
  recordDiagnostic(
    ctx,
    "module-export-conflict",
    "default",
    'export "default" was skipped because it collides with the component\'s own default export.',
    sourceRangeFromNode(ctx, node),
  );
}

function addModuleClassExport(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  declaration: ClassDeclaration,
  specifier: ResolvedExportSpecifier | undefined,
) {
  const localName = declaration.id?.name;
  if (!localName) return;
  const name = specifier?.exportedName ?? localName;
  const jsdocInfo = exportJSDoc(ctx, node, specifier);
  const {
    members,
    typeParameters,
    extends: baseClass,
    implements: implemented,
  } = readClassDeclaration(ctx, declaration);
  const classTypeParameters = typeParameters ?? jsdocInfo?.typeParameters;

  addModuleExport(ctx, name, {
    name,
    ...(localName === name ? {} : { localName }),
    kind: "class",
    description: jsdocInfo?.description,
    deprecated: jsdocInfo?.deprecated,
    tags: jsdocInfo?.tags,
    ...(jsdocInfo?.internal ? { internal: true as const } : {}),
    type: `typeof ${localName}`,
    ...(classTypeParameters ? { typeParameters: classTypeParameters } : {}),
    members,
    ...(declaration.abstract ? { abstract: true as const } : {}),
    ...(baseClass ? { extends: baseClass } : {}),
    ...(implemented ? { implements: implemented } : {}),
    isFunction: false,
    isFunctionDeclaration: false,
    isRequired: false,
    constant: false,
    reactive: false,
    source: sourceRangeFromNode(ctx, node),
  });
}

/** The exports a module-script `export` declaration (or one specifier of an `export { ... }`) declares. */
function addModuleDeclarationExports(
  ctx: ParserContext,
  node: ExportNamedDeclaration,
  declaration: NonNullable<ExportNamedDeclaration["declaration"]>,
  specifier?: ResolvedExportSpecifier,
) {
  if (declaration.type === "ClassDeclaration") {
    addModuleClassExport(ctx, node, declaration, specifier);
    return;
  }

  const declarators = collectExportDeclarators(ctx, declaration, specifier, "moduleExports");
  if (declarators.length === 0) return;

  const jsdocInfo = exportJSDoc(ctx, node, specifier);

  for (const declarator of declarators) {
    const { prop_name, kind } = declarator;
    const { type, typeSource, description, params, returnType, isFunction, typeParameters } =
      resolveExportDeclaratorTypeAndDocs(ctx, declarator, jsdocInfo);

    addModuleExport(ctx, prop_name, {
      name: prop_name,
      kind,
      description,
      deprecated: jsdocInfo?.deprecated,
      tags: jsdocInfo?.tags,
      ...(jsdocInfo?.internal ? { internal: true as const } : {}),
      type,
      typeSource,
      value: declarator.value,
      defaultValue: declarator.defaultValue,
      params,
      returnType,
      typeParameters,
      isFunction,
      isFunctionDeclaration: declarator.isFunctionDeclaration,
      isRequired: false,
      constant: kind === "const",
      reactive: false,
      source: sourceRangeFromNode(ctx, node),
    });
  }
}

/**
 * The `.d.ts` can only say `extends Base` when `Base` is in scope there:
 * imported, or another exported class. A class extending anything else
 * (a local class, a call like `mixin(Base)`) is declared without it, and
 * flagged, since consumers won't see its inherited members.
 */
function dropUndeclaredClassBases(ctx: ParserContext) {
  const classes = Array.from(ctx.moduleExports.values()).filter((entry) => entry.kind === "class");
  const declared = new Set(classes.map((entry) => entry.localName ?? entry.name));
  for (const entry of classes) {
    if (!entry.extends) continue;
    const base = CLASS_BASE_NAME_REGEX.exec(entry.extends)?.[0];
    if (
      base &&
      (declared.has(base) ||
        ctx.valueImportBindingsByLocalName.has(base) ||
        ctx.typeImportBindingsByLocalName.has(base))
    ) {
      continue;
    }
    recordDiagnostic(
      ctx,
      "export-unresolved",
      entry.name,
      `class "${entry.name}" extends \`${entry.extends}\`, which isn't imported or an exported class, so the .d.ts declares it without \`extends\` and its inherited members are missing. Export the base class from the module script.`,
      entry.source,
    );
    entry.extends = undefined;
  }
}

/**
 * Not fused with the component walk: `module` is a separate root, and one
 * synthetic root would need branch-tracking to keep module and instance
 * export handling apart, for a pass most components skip.
 */
export function walkModuleScript(ctx: ParserContext): void {
  const module = ctx.parsed?.module;
  if (!module) return;

  const reExportableImports = collectReExportableImports(module);

  walk(module, {
    enter(node, parent) {
      // The module script is in scope for the instance script's prop defaults.
      if (node.type === "ImportDeclaration") collectValueImportBindings(ctx, node);
      if (node.type === "FunctionDeclaration" && node.id?.name) ctx.funcDecls.set(node.id.name, node);
      if (node.type === "VariableDeclaration") ctx.vars.add(node);

      if (node.type === "ExportNamedDeclaration") {
        if (node.declaration != null) {
          addModuleDeclarationExports(ctx, node, node.declaration);
          return;
        }
        const from = node.source?.value;
        const program = parent?.type === "Program" ? parent : null;
        for (const specifier of node.specifiers) {
          const resolved = resolveExportSpecifier(ctx, node, specifier, program, "module");
          if (!resolved) continue;
          if (resolved.exportedName === "default") {
            recordDefaultExportConflict(ctx, node);
            continue;
          }
          const reExport =
            typeof from === "string"
              ? { from, imported: resolved.localName }
              : reExportableImports.get(resolved.localName);
          if (resolved.declaration) {
            addModuleDeclarationExports(ctx, node, resolved.declaration, resolved);
          } else if (reExport) {
            addModuleReExport(ctx, node, resolved.exportedName, reExport);
          } else if (!ctx.localTypeDeclarationsByName.get(resolved.localName)?.exported) {
            // A type exported this way is emitted with the module's other types.
            recordUnresolvedExportSpecifier(ctx, node, resolved.localName, resolved.exportedName);
          }
        }
      }

      if (node.type === "ExportAllDeclaration" && typeof node.source.value === "string") {
        const name = (node.exported && moduleExportName(node.exported)) ?? "*";
        if (name === "default") {
          recordDefaultExportConflict(ctx, node);
          return;
        }
        addModuleReExport(ctx, node, name, { from: node.source.value, imported: "*" });
      }
    },
  });
  dropUndeclaredClassBases(ctx);
}
