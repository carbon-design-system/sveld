import type { Component } from "svelte";

export declare function make(): Item;

export interface Item {
  id: string;
}

type $Props = { item: Item };

export type ModuleScriptTypesRunesProps = $Props;

export type ModuleScriptTypesRunesExports = Record<string, never>;

declare const ModuleScriptTypesRunes: Component<
  ModuleScriptTypesRunesProps,
  ModuleScriptTypesRunesExports,
  ""
>;
export default ModuleScriptTypesRunes;
