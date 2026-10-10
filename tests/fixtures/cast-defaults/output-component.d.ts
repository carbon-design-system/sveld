import type { Component } from "svelte";
import type { HTMLButtonAttributes } from "svelte/elements";

type Size = "sm" | "md";

export type CastDefaultsProps = {
  /**
   * @default { type: "button" }
   */
  attributes?: HTMLButtonAttributes;

  /**
   * @default "sm"
   */
  size?: Size;

  /**
   * @default []
   */
  sizes?: Size[];

  /**
   * @default { type: "button" }
   */
  checked?: { type: string };
};

export type CastDefaultsExports = Record<string, never>;

declare const CastDefaults: Component<
  CastDefaultsProps,
  CastDefaultsExports,
  ""
>;
export default CastDefaults;
