import { SvelteComponentTyped } from "svelte";

export type LegacyButtonProps = {
  /**
   * Label text
   * @default undefined
   */
  label: undefined;

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;

  children?: (this: void) => void;
};

export default class LegacyButton extends SvelteComponentTyped<
  LegacyButtonProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
