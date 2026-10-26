import { SvelteComponentTyped } from "svelte";

export interface Entry {
  id: string
}

export type RunesScriptGenericsAttributeJsProps<Item extends Entry = Entry> = {
  /**
   * @default []
   */
  items?: ReadonlyArray<Item>;

  selected?: Item;
};

export default class RunesScriptGenericsAttributeJs<Item extends Entry = Entry> extends SvelteComponentTyped<
  RunesScriptGenericsAttributeJsProps<Item>,
  Record<string, any>,
  Record<string, never>
> {}
