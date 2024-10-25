import type { SvelteComponentTyped } from "svelte";

export type SelectItemProps = {
  /**
   * Specify the option value
   * @default ""
   */
  value?: string;

  /**
   * Specify the option text
   * @default ""
   */
  text?: string;

  /**
   * Set to `true` to hide the option
   * @default false
   */
  hidden?: boolean;

  /**
   * Set to `true` to disable the option
   * @default false
   */
  disabled?: boolean;
};

export default class SelectItem extends SvelteComponentTyped<
  SelectItemProps,
  Record<string, any>,
  {}
> {}
