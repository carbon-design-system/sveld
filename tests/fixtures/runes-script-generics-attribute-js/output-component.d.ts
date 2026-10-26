import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type RunesScriptGenericsAttributeJsExports = Record<string, never>;

interface RunesScriptGenericsAttributeJsComponent {
  new <Item extends Entry = Entry>(
    options: ComponentConstructorOptions<RunesScriptGenericsAttributeJsProps<Item>>
  ): SvelteComponent<RunesScriptGenericsAttributeJsProps<Item>> & RunesScriptGenericsAttributeJsExports;
  <Item extends Entry = Entry>(
    this: void,
    internals: ComponentInternals,
    props: RunesScriptGenericsAttributeJsProps<Item>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesScriptGenericsAttributeJsProps<Item>>): void;
  } & RunesScriptGenericsAttributeJsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesScriptGenericsAttributeJs: RunesScriptGenericsAttributeJsComponent;
export default RunesScriptGenericsAttributeJs;
