import type { Component } from "svelte";

export type ContextUnresolvableKeyProps = {
  /**
   * @default "modal"
   */
  dynamicKey?: string;

  children?: (this: void) => void;
};

export type ContextUnresolvableKeyExports = Record<string, never>;

declare const ContextUnresolvableKey: Component<
  ContextUnresolvableKeyProps,
  ContextUnresolvableKeyExports,
  ""
>;
export default ContextUnresolvableKey;
