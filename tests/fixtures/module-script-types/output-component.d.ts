import type { Component } from "svelte";
import type { Base } from "./base.js";

export declare function make(label: string): Item;

type Internal = { raw: string };

export interface Item extends Base {
  label: string;
}

export type Mode = "compact" | "full";

export type Density = "tight" | "loose";

export type ModuleScriptTypesProps = {
  item: Item;

  /**
   * @default "full"
   */
  mode?: Mode;

  /**
   * @default undefined
   */
  internal?: Internal | undefined;
};

export type ModuleScriptTypesExports = Record<string, never>;

declare const ModuleScriptTypes: Component<
  ModuleScriptTypesProps,
  ModuleScriptTypesExports,
  ""
>;
export default ModuleScriptTypes;
