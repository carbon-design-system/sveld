import type { Component } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

type $RestProps = HTMLAttributes<HTMLElement>;

type $Props = {
  /**
   * @default "div"
   */
  tag?: keyof HTMLElementTagNameMap;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type RestPropsJsdocSvelteElementProps = Omit<$RestProps, keyof $Props> & $Props;

export type RestPropsJsdocSvelteElementExports = Record<string, never>;

declare const RestPropsJsdocSvelteElement: Component<
  RestPropsJsdocSvelteElementProps,
  RestPropsJsdocSvelteElementExports,
  ""
>;
export default RestPropsJsdocSvelteElement;
