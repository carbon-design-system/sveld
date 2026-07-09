import { SvelteComponentTyped } from "svelte";

export type ContextUnresolvableKeyProps = {
  /**
   * @default "modal"
   */
  dynamicKey?: string;

  children?: (this: void) => void;
};

export default class ContextUnresolvableKey extends SvelteComponentTyped<
  ContextUnresolvableKeyProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
