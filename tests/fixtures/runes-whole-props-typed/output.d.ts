import { SvelteComponentTyped } from "svelte";

export type RunesWholePropsTypedProps = {
  /**
   * @default undefined
   */
  item: string;

  /**
   * @default undefined
   */
  disabled?: boolean;

  children?: (this: void, ...args: [{ item: string }]) => void;
};

export default class RunesWholePropsTyped extends SvelteComponentTyped<
  RunesWholePropsTypedProps,
  Record<string, any>,
  { default: { item: string } }
> {}
