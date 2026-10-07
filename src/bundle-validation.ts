/** Checks that span components, run once every component has parsed and been resolved. */
import { dirname } from "node:path";
import type { ComponentDocApi, ComponentDocs, ResolveComponentFilePath } from "./bundle";
import { createDiagnostic, type SveldDiagnostic } from "./diagnostics";
import type { ModuleGraph } from "./module-graph";
import { MODULE_EXTENSIONS } from "./path";
import { exportsTypeName, propsTypeName } from "./writer/writer-ts-definitions-core";

/** An import's extensions, and a component's: `"./Base"` may name `Base.svelte`. */
const EXTENDS_TARGET_EXTENSIONS = [...MODULE_EXTENSIONS, ".svelte"];

/** `@extends`/`@extendProps` import specifiers are stored with their quotes. */
function stripQuotes(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length < 2) return undefined;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' || first === "'" || first === "`") && first === last) {
    return trimmed.slice(1, -1);
  }
  return undefined;
}

/**
 * Flags a module-script re-export named like the component's generated
 * `<Name>Props`/`<Name>Exports` type. The `.d.ts` only breaks if the
 * re-exported binding also carries a type, which isn't knowable without
 * resolving the source, so this is a warning.
 */
export function validateModuleReExportNames(component: ComponentDocApi): SveldDiagnostic[] {
  const diagnostics: SveldDiagnostic[] = [];
  const reExports = component.moduleExports.filter((moduleExport) => moduleExport.kind === "re-export");
  if (reExports.length === 0) return diagnostics;

  const generatedTypeNames = new Set([propsTypeName(component.moduleName), exportsTypeName(component.moduleName)]);
  for (const reExport of reExports) {
    if (!generatedTypeNames.has(reExport.name)) continue;
    diagnostics.push(
      createDiagnostic({
        component: component.filePath,
        kind: "module-export-conflict",
        name: reExport.name,
        message: `Re-export "${reExport.name}" has the same name as the generated "${reExport.name}" type; the .d.ts won't type-check if "${reExport.reExport?.from}" exports a type by that name.`,
        source: reExport.source,
      }),
    );
  }
  return diagnostics;
}

/**
 * Checks a component's `@extends`/`@extendProps` target: the file must exist,
 * and when it's a bundled `.svelte` file, the named interface must match its
 * generated `<Name>Props`. Also flags an own prop whose type differs from the
 * target's same-named prop, since `Base & $Props` collapses it to `never`.
 * Bare/package specifiers are skipped.
 */
export function createExtendsTargetValidator(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
  graph: ModuleGraph,
): (component: ComponentDocApi) => SveldDiagnostic[] {
  const componentsByAbsolutePath = new Map(
    Array.from(components.values()).map((component) => [resolveComponentFilePath(component.filePath), component]),
  );

  return (component) => {
    const extendsInfo = component.extends;
    if (!extendsInfo) return [];

    const specifier = stripQuotes(extendsInfo.import);
    if (specifier === undefined || (!specifier.startsWith(".") && !specifier.startsWith("/"))) return [];

    const fromAbsoluteFilePath = resolveComponentFilePath(component.filePath);
    const targetPath = graph.resolve(specifier, dirname(fromAbsoluteFilePath), EXTENDS_TARGET_EXTENSIONS);

    if (targetPath === null) {
      return [
        createDiagnostic({
          component: component.filePath,
          kind: "extend-props-target-missing",
          name: extendsInfo.interface,
          message: `@extends/@extendProps target "${specifier}" was not found on disk.`,
        }),
      ];
    }

    // A file outside the bundle (e.g. a hand-written .ts interface): existence is all that's verifiable.
    const target = componentsByAbsolutePath.get(targetPath);
    if (!target) return [];

    const expectedInterface = propsTypeName(target.moduleName);
    if (extendsInfo.interface !== expectedInterface) {
      return [
        createDiagnostic({
          component: component.filePath,
          kind: "extend-props-target-missing",
          name: extendsInfo.interface,
          message: `@extends/@extendProps names "${extendsInfo.interface}", but "${specifier}" generates "${expectedInterface}".`,
        }),
      ];
    }

    const diagnostics: SveldDiagnostic[] = [];
    for (const ownProp of component.props) {
      const baseProp = target.props.find((prop) => prop.name === ownProp.name);
      if (baseProp && baseProp.type !== ownProp.type) {
        diagnostics.push(
          createDiagnostic({
            component: component.filePath,
            kind: "extend-props-override",
            name: ownProp.name,
            message: `Own prop "${ownProp.name}" (${ownProp.type}) overrides "${expectedInterface}"'s "${ownProp.name}" (${baseProp.type}).`,
          }),
        );
      }
    }
    return diagnostics;
  };
}
