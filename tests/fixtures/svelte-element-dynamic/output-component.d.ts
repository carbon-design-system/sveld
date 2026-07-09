import type { Component } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

type $RestProps = HTMLAttributes<HTMLElement>;

type $Props = {
  /**
   * @default "div"
   */
  tag?: string;

  [key: `data-${string}`]: unknown;
};

export type SvelteElementDynamicProps = Omit<$RestProps, keyof $Props> & $Props;

export type SvelteElementDynamicExports = Record<string, never>;

declare const SvelteElementDynamic: Component<
  SvelteElementDynamicProps,
  SvelteElementDynamicExports,
  ""
>;
export default SvelteElementDynamic;
