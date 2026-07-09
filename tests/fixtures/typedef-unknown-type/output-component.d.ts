import type { Component } from "svelte";

export type TypedefUnknownTypeProps = {
  /**
   * A value of unknown shape. Prefer `unknown` over `any`: consumers must
   * narrow it before use instead of silently opting out of type checking.
   * @default undefined
   */
  payload: unknown;

  /**
   * An escape hatch typed as `any`, shown for contrast. `any` disables type
   * checking everywhere it flows, so reach for `unknown` at boundaries instead.
   * @default undefined
   */
  raw: any;
};

export type TypedefUnknownTypeExports = Record<string, never>;

declare const TypedefUnknownType: Component<
  TypedefUnknownTypeProps,
  TypedefUnknownTypeExports,
  ""
>;
export default TypedefUnknownType;
