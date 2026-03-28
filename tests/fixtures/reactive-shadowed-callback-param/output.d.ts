import { SvelteComponentTyped } from "svelte";

export type ReactiveShadowedCallbackParamProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export default class ReactiveShadowedCallbackParam extends SvelteComponentTyped<
  ReactiveShadowedCallbackParamProps,
  Record<string, any>,
  Record<string, never>
> {}
