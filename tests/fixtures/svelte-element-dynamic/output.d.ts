import type { SvelteComponentTyped } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

type $RestProps = HTMLAttributes<HTMLElement>;

type $Props = {
  /**
   * @default "div"
   */
  tag?: string;

  [key: `data-${string}`]: any;
};

export type SvelteElementDynamicProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SvelteElementDynamic extends SvelteComponentTyped<
  SvelteElementDynamicProps,
  Record<string, any>,
  Record<string, never>
> {}
