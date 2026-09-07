import { SvelteComponentTyped } from "svelte";

export type BadgeProps = {
  /**
   * @deprecated Use `Tag` instead.
   * @default "gray"
   */
  color?: string;

  children?: (this: void) => void;
};

export default class Badge extends SvelteComponentTyped<
  BadgeProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
