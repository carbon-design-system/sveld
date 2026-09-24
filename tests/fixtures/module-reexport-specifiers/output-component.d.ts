import type { Component } from "svelte";

export * from "./other.js";

export { a as b, c } from "./other.js";

export { toHierarchy } from "./to-hierarchy.js";

export { formatName as format, getInitials } from "./initials.js";

export * as trees from "./to-hierarchy.js";

export type ModuleReexportSpecifiersProps = Record<string, never>;

export type ModuleReexportSpecifiersExports = Record<string, never>;

declare const ModuleReexportSpecifiers: Component<
  ModuleReexportSpecifiersProps,
  ModuleReexportSpecifiersExports,
  ""
>;
export default ModuleReexportSpecifiers;
