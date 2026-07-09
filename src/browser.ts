/**
 * Browser-safe entry point.
 *
 * Everything exported here avoids Node built-ins (`node:fs`, `node:path`, ...),
 * so it bundles for the browser (Vite, esbuild, webpack, Rollup) without a
 * polyfill. It covers parsing a single component's source and rendering that
 * result to JSON, Markdown, TypeScript definitions, or a Custom Elements
 * Manifest — everything except the filesystem-driven project scanning
 * (`sveld()`/`pluginSveld()`) and CLI, which only make sense in Node.
 *
 * @example
 * ```ts
 * import { asNormalizedPath, ComponentParser, buildComponentApiDocument } from "sveld/browser";
 *
 * const parser = new ComponentParser();
 * const diagnostics = { moduleName: "Button", filePath: "Button.svelte" };
 * const parsed = parser.parseSvelteComponent(source, diagnostics);
 *
 * // `parseSvelteComponent` returns component metadata only; add the fields
 * // `ComponentDocApi` needs (`moduleName`, `filePath`) yourself.
 * const component = {
 *   ...parsed,
 *   moduleName: diagnostics.moduleName,
 *   filePath: asNormalizedPath(diagnostics.filePath),
 * };
 *
 * const doc = buildComponentApiDocument(new Map([[component.moduleName, component]]));
 * ```
 */
export { asNormalizedPath, type NormalizedPath } from "./brands";
export { default as ComponentParser, type SerializedComponentEvent } from "./ComponentParser";
export type { SveldDiagnostic, SveldDiagnosticKind } from "./diagnostics";
export type { ComponentDocApi, ComponentDocs } from "./plugin";
export {
  type BuildComponentApiDocumentOptions,
  buildComponentApiDocument,
  COMPONENT_API_SCHEMA_VERSION,
  type ComponentApiDocument,
} from "./writer/document-model";
export type { AppendType, MarkdownWriterBase, TocLine } from "./writer/MarkdownWriterBase";
export { renderComponentsToMarkdown } from "./writer/markdown-render-utils";
export {
  type BuildCustomElementsManifestOptions,
  buildCustomElementsManifest,
  type CemAttribute,
  type CemClassDeclaration,
  type CemClassField,
  type CemCustomElementExport,
  type CemEvent,
  type CemExport,
  type CemJavaScriptExport,
  type CemModule,
  type CemSlot,
  type CemType,
  type CustomElementsManifest,
} from "./writer/writer-custom-elements-core";
export {
  BrowserWriterMarkdown,
  type WriteMarkdownCoreOptions,
  writeMarkdownCore,
} from "./writer/writer-markdown-core";
export {
  formatTsProps,
  getContextDefs,
  getTypeDefs,
  type WriteTsDefinitionOptions,
  writeTsDefinition,
} from "./writer/writer-ts-definitions-core";
