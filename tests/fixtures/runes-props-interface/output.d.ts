import { SvelteComponentTyped } from "svelte";

export type RunesPropsInterfaceProps = {
  /**
   * @default undefined
   */
  foo: string;

  /**
   * @default undefined
   */
  bar?: number;
};

export default class RunesPropsInterface extends SvelteComponentTyped<
  RunesPropsInterfaceProps,
  Record<string, any>,
  Record<string, never>
> {}
