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
   * @default []
   */
  angleSizes?: Size[];

  /**
   * @default { type: "button" }
   */
  checked?: { type: string };

  /**
   * @default 5
   */
  count?: number;
};

export type CastDefaultsExports = Record<string, never>;

declare const CastDefaults: Component<
  CastDefaultsProps,
  CastDefaultsExports,
  ""
>;
export default CastDefaults;
