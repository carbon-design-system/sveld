import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { Snippet } from "svelte";

type $Props<Item extends { id: string | number } = { id: string }> = {
  items: Item[];
  row: Snippet<[item: Item]>;
};

export type RunesGenericListProps<Item extends { id: string | number } = { id: string }> = $Props<Item>;

export type RunesGenericListExports = Record<string, never>;

interface RunesGenericListComponent {
  new <Item extends { id: string | number } = { id: string }>(
    options: ComponentConstructorOptions<RunesGenericListProps<Item>>
  ): SvelteComponent<RunesGenericListProps<Item>> & RunesGenericListExports;
  <Item extends { id: string | number } = { id: string }>(
    this: void,
    internals: ComponentInternals,
    props: RunesGenericListProps<Item>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesGenericListProps<Item>>): void;
  } & RunesGenericListExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesGenericList: RunesGenericListComponent;
export default RunesGenericList;
