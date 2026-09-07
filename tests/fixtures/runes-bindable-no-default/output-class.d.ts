import { SvelteComponentTyped } from "svelte";

export type RunesBindableNoDefaultProps = {
  /**
   * @default 0
   */
  value?: number;

  open?: any;

  onclick: any;
};

export default class RunesBindableNoDefault extends SvelteComponentTyped<
  RunesBindableNoDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
