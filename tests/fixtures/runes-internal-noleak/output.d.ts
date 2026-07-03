import { SvelteComponentTyped } from "svelte";

export type RunesInternalNoleakProps = {
  /**
   * @default undefined
   */
  value: undefined;

  /**
   * @default undefined
   */
  onchange: undefined;
};

export default class RunesInternalNoleak extends SvelteComponentTyped<
  RunesInternalNoleakProps,
  Record<string, any>,
  Record<string, never>
> {}
