import type { Component } from "svelte";
import type { Item } from "./types.js";

export declare const sizes: Size[];

export declare const registry: Map<string, Item>;

export declare let current: Item | undefined;

export declare const fallback: Size;

type Size = "sm" | "lg";

export type ModuleScriptAnnotatedExportsProps = {
  /**
   * @default ""
   */
  label?: string | number;
};

export type ModuleScriptAnnotatedExportsExports = Record<string, never>;

declare const ModuleScriptAnnotatedExports: Component<
  ModuleScriptAnnotatedExportsProps,
  ModuleScriptAnnotatedExportsExports,
  ""
>;
export default ModuleScriptAnnotatedExports;
