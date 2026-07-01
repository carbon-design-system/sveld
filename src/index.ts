export { default as ComponentParser, type SerializedComponentEvent } from "./ComponentParser";
export {
  type ApiChange,
  type CheckResult,
  diffApiDocuments,
  formatCheckReport,
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
