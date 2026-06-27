export { default as ComponentParser, type SerializedComponentEvent } from "./ComponentParser";
export { cli } from "./cli";
export type { SveldDiagnostic, SveldDiagnosticKind } from "./diagnostics";
export {
  type ComponentApiFile,
  type DiffChange,
  type DiffChangeKind,
  type DiffOptions,
  type DiffResult,
  type DiffSeverity,
  type DiffSummary,
  diffComponentApi,
  formatDiffReport,
} from "./diff";
export type { SvelteEntryPoint } from "./get-svelte-entry";
export { defineConfig, type SveldConfig } from "./load-config";
export { default } from "./plugin";
export { sveld } from "./sveld";
