import path from "node:path";
import { info } from "../logger";
import { normalizeSeparators } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { createJsonWriter } from "./Writer";
import { buildCustomElementsManifest } from "./writer-custom-elements-core";

export type {
  CemAttribute,
  CemClassDeclaration,
  CemClassField,
  CemCustomElementExport,
  CemEvent,
  CemExport,
  CemJavaScriptExport,
  CemModule,
  CemSlot,
  CemType,
  CustomElementsManifest,
} from "./writer-custom-elements-core";

export interface WriteCustomElementsOptions {
  inputDir: string;
  outFile: string;
  /** Report the resolved path instead of writing. Set by `sveld --dry-run`. */
  dryRun?: boolean;
}

/**
 * Normalizes `filePath` to be resolvable from `cwd`, matching the JSON
 * writer's convention so `custom-elements.json` is self-describing.
 */
function normalizedModulePath(component: ComponentDocApi, inputDir: string): string {
  return normalizeSeparators(path.join(inputDir, path.normalize(component.filePath)));
}

/**
 * Renders the Custom Elements Manifest document without touching disk. Used
 * by both `writeCustomElements` and the CLI's `--stdout` mode so the two
 * channels can't drift.
 */
export function renderCustomElementsManifest(
  components: ComponentDocs,
  options: Pick<WriteCustomElementsOptions, "inputDir">,
): string {
  const manifest = buildCustomElementsManifest(components, {
    resolveModulePath: (component) => normalizedModulePath(component, options.inputDir),
  });

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Writes component documentation as a Custom Elements Manifest
 * (schemaVersion "1.0.0"). Components without a `customElementTag` (i.e. not
 * compiled with `<svelte:options customElement="..." />`) still emit a plain
 * class declaration; the manifest is most useful for `customElement`-compiled
 * builds, where editors, Storybook, and other CEM-aware tooling can resolve
 * `tagName`, `attributes`, and `events`.
 */
export default async function writeCustomElements(components: ComponentDocs, options: WriteCustomElementsOptions) {
  const raw = renderCustomElementsManifest(components, options);

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = createJsonWriter({ dryRun: options.dryRun });
  await writer.write(output_path, raw);

  if (!options.dryRun) info(`created "${options.outFile}".`);
}
