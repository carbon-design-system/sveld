/**
 * Browser-safe entry point.
 *
 * Everything exported here avoids Node built-ins (`node:fs`, `node:path`, ...),
 * so it bundles for the browser (Vite, esbuild, webpack, Rollup) without a
 * polyfill. It covers parsing a single component's source and rendering that
 * result to JSON, Markdown, or TypeScript definitions: everything except the
 * filesystem-driven project scanning (`sveld()`/`pluginSveld()`) and CLI,
 * which only make sense in Node.
 *
 * @example
 * ```ts
 * import {
 *   asNormalizedPath,
 *   ComponentParser,
 *   buildComponentApiDocument,
 *   finalizeWithoutCrossFileResolution,
 * } from "sveld/browser";
 *
 * const parser = new ComponentParser();
 * const diagnostics = { moduleName: "Button", filePath: "Button.svelte" };
 * // Nothing here reads imported files: record a `cross-file-unresolved`
 * // warning for each import the output depends on.
 * const parsed = finalizeWithoutCrossFileResolution(parser.parseSvelteComponent(source, diagnostics), diagnostics);
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
export {
  type FinalizeWithoutCrossFileResolutionOptions,
  finalizeWithoutCrossFileResolution,
} from "./finalize-standalone";
export type { ComponentDocApi, ComponentDocs } from "./plugin";
export {
  type BuildComponentApiDocumentOptions,
  buildComponentApiDocument,
  COMPONENT_API_SCHEMA_VERSION,
  type ComponentApiDocument,
} from "./writer/document-model";
export {
  type AppendType,
  BrowserWriterMarkdown,
  MarkdownDocument,
  type MarkdownWriterBase,
  type TocLine,
} from "./writer/markdown-document";
export { renderComponentsToMarkdown } from "./writer/markdown-render-utils";
export { type WriteMarkdownCoreOptions, writeMarkdownCore } from "./writer/writer-markdown-core";
export {
  formatTsProps,
  getContextDefs,
  getTypeDefs,
  type WriteTsDefinitionOptions,
  writeTsDefinition,
} from "./writer/writer-ts-definitions-core";
