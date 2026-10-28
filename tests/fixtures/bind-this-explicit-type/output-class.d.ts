import { SvelteComponentTyped } from "svelte";

export type BindThisExplicitTypeProps = {
  href?: string | undefined;

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

export default class BindThisExplicitType extends SvelteComponentTyped<
  BindThisExplicitTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
