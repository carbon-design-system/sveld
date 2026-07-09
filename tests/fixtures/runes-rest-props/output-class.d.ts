import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default undefined
   */
  variant: undefined;

  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RunesRestProps extends SvelteComponentTyped<
  RunesRestPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
