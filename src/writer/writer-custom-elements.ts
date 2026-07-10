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
}

/**
 * Normalizes `filePath` to be resolvable from `cwd`, matching the JSON
 * writer's convention so `custom-elements.json` is self-describing.
 */
function normalizedModulePath(component: ComponentDocApi, inputDir: string): string {
  return normalizeSeparators(path.join(inputDir, path.normalize(component.filePath)));
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
  const manifest = buildCustomElementsManifest(components, {
    resolveModulePath: (component) => normalizedModulePath(component, options.inputDir),
  });

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = createJsonWriter();
  await writer.write(output_path, `${JSON.stringify(manifest, null, 2)}\n`);

  info(`created "${options.outFile}".`);
}
