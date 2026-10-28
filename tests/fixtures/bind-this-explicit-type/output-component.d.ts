import type { Component } from "svelte";

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

export type BindThisExplicitTypeExports = Record<string, never>;

declare const BindThisExplicitType: Component<
  BindThisExplicitTypeProps,
  BindThisExplicitTypeExports,
  ""
>;
export default BindThisExplicitType;
