/**
 * `ComponentParser` itself is intentionally not re-exported here: doing so
 * would statically pull the parser stack (acorn, `@sveltejs/acorn-typescript`,
 * estree-walker) into every consumer of this entry point, even ones that only
 * want `bundle`/`sveld`/`defineConfig` and never parse a component directly.
 * `bundle()` already defers that cost via `./parser-stack`'s dynamic import.
 * Node consumers who want direct, low-level parsing access can import
 * `ComponentParser` from `sveld/browser`, which works fine outside a browser.
 */
export type { SerializedComponentEvent } from "./ComponentParser";
export {
  type ApiChange,
  type CheckReportJson,
  type CheckResult,
  diffApiDocuments,
  formatCheckReport,
  formatCheckReportJson,
  runCheck,
  type SemverBump,
} from "./check";
export { cli } from "./cli";
export type { SveldDiagnostic, SveldDiagnosticKind } from "./diagnostics";
export type { SvelteEntryPoint } from "./get-svelte-entry";
export { defineConfig, type SveldConfig } from "./load-config";
export { default } from "./plugin";
export { sveld } from "./sveld";
export { buildComponentApiDocument, type ComponentApiDocument } from "./writer/document-model";
export { getWriter, listWriters, type OutputWriter, registerWriter } from "./writer/registry";
