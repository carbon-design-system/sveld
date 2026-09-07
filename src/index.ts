export { default as ComponentParser, type SerializedComponentEvent } from "./ComponentParser";
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
export {
  DIAGNOSTIC_CODES,
  type SveldDiagnostic,
  type SveldDiagnosticKind,
  type SveldDiagnosticSeverity,
} from "./diagnostics";
export type { SvelteEntryPoint } from "./get-svelte-entry";
export { defineConfig, type SveldConfig, type SveldRuntimeOptions } from "./load-config";
export { default } from "./plugin";
export { type SveldResult, sveld } from "./sveld";
export { buildComponentApiDocument, type ComponentApiDocument } from "./writer/document-model";
export { getWriter, listWriters, type OutputWriter, registerWriter } from "./writer/registry";
