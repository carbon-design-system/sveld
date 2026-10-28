import type { Component } from "svelte";

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

export type RunesBindThisExplicitTypeExports = Record<string, never>;

declare const RunesBindThisExplicitType: Component<
  RunesBindThisExplicitTypeProps,
  RunesBindThisExplicitTypeExports,
  "ref" | "buttonRef" | "inferredRef"
>;
export default RunesBindThisExplicitType;
