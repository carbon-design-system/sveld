import { SvelteComponentTyped } from "svelte";
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

export default class RestPropsJsdocSvelteElement extends SvelteComponentTyped<
  RestPropsJsdocSvelteElementProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
