import { SvelteComponentTyped } from "svelte";

export interface Row {
  id: string
}

export type GenericsAttributeJsProps<R extends Row = Row> = {
  /**
   * @default []
   */
  rows?: ReadonlyArray<R>;

  children?: (this: void, ...args: [{ rows: ReadonlyArray<R> }]) => void;
};

export default class GenericsAttributeJs<R extends Row = Row> extends SvelteComponentTyped<
  GenericsAttributeJsProps<R>,
  Record<string, any>,
  { default: { rows: ReadonlyArray<R> } }
> {}
