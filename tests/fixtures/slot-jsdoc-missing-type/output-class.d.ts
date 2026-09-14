import { SvelteComponentTyped } from "svelte";

export type SlotJsdocMissingTypeProps = {
  /**
   * @default ""
   */
  title?: string;

  named?: (this: void) => void;
};

export default class SlotJsdocMissingType extends SvelteComponentTyped<
  SlotJsdocMissingTypeProps,
  Record<string, any>,
  { named: Record<string, never> }
> {}
