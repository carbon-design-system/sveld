import type { Component } from "svelte";

/**
 * The full set of options. Other prop types are derived from this one
 * instead of redeclaring its fields.
 */
export interface Options {
  id: string;
  size: "sm" | "md" | "lg";
  disabled: boolean
}

/**
 * A factory that produces an `Options` value.
 */
export type Factory = () => Options;

export type TypedefUtilityTypesProps = {
  /**
   * A read-only subset of `Options`.
   * @default undefined
   */
  summary: Pick<Options, "id" | "size">;

  /**
   * Everything in `Options` except `disabled`.
   * @default undefined
   */
  editable: Omit<Options, "disabled">;

  /**
   * Derived from the factory's return type rather than restated.
   * @default undefined
   */
  defaults: ReturnType<Factory>;

  /**
   * The resolved value of an async source.
   * @default undefined
   */
  resolved: Awaited<Promise<Options>>;
};

export type TypedefUtilityTypesExports = Record<string, never>;

declare const TypedefUtilityTypes: Component<
  TypedefUtilityTypesProps,
  TypedefUtilityTypesExports,
  ""
>;
export default TypedefUtilityTypes;
