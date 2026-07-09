import { SvelteComponentTyped } from "svelte";

export type RunesCallbackPropsProps = {
  /**
   * @default undefined
   */
  onclick: undefined;
};

export default class RunesCallbackProps extends SvelteComponentTyped<
  RunesCallbackPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
