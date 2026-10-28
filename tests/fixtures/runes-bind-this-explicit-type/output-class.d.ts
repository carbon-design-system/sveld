import { SvelteComponentTyped } from "svelte";

export type RunesBindThisExplicitTypeProps = {
  href?: string;

  /**
   * @default null
   */
  ref?: null | HTMLAnchorElement | HTMLButtonElement;

  /**
   * @default null
   */
  buttonRef?: null | HTMLElement;

  /**
   * @default null
   */
  inferredRef?: null | HTMLDivElement;
};

export default class RunesBindThisExplicitType extends SvelteComponentTyped<
  RunesBindThisExplicitTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
