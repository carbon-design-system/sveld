import { SvelteComponentTyped } from "svelte";

export type ReactiveShadowedEachBindingProps = {
  /**
   * @default ""
   */
  value?: string;
};

export default class ReactiveShadowedEachBinding extends SvelteComponentTyped<
  ReactiveShadowedEachBindingProps,
  Record<string, any>,
  Record<string, never>
> {}
