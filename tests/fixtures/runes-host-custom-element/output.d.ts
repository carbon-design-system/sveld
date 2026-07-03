import { SvelteComponentTyped } from "svelte";

export type RunesHostCustomElementProps = {
  /**
   * @default undefined
   */
  value: undefined;
};

export default class RunesHostCustomElement extends SvelteComponentTyped<
  RunesHostCustomElementProps,
  Record<string, any>,
  Record<string, never>
> {}
