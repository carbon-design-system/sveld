import { SvelteComponentTyped } from "svelte";

export type DefaultSlotWithPropsProps = {
  /**
   * @default []
   */
  items?: string[];

  children?: (this: void, ...args: [{ item: string; index: number; isFirst: boolean; isLast: boolean }]) => void;
};

export default class DefaultSlotWithProps extends SvelteComponentTyped<
  DefaultSlotWithPropsProps,
  Record<string, any>,
  { default: { item: string; index: number; isFirst: boolean; isLast: boolean } }
> {}
