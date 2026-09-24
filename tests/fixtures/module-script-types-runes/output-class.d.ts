import { SvelteComponentTyped } from "svelte";

export declare function make(): Item;

export interface Item {
  id: string;
}

type $Props = { item: Item };

export type ModuleScriptTypesRunesProps = $Props;

export default class ModuleScriptTypesRunes extends SvelteComponentTyped<
  ModuleScriptTypesRunesProps,
  Record<string, any>,
  Record<string, never>
> {}
