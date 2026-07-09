import type { Component } from "svelte";

/**
 * A branded string. At runtime it is a plain `string`, but the brand makes it
 * a distinct domain type that other strings cannot be assigned to.
 */
export type UserId = string & { readonly __brand: "UserId" };

/**
 * A branded number representing a monetary amount in cents.
 */
export type Cents = number & { readonly __brand: "Cents" };

export type TypedefBrandedTypesProps = {
  /**
   * A branded string. At runtime it is a plain `string`, but the brand makes it
   * a distinct domain type that other strings cannot be assigned to.
   * @default undefined
   */
  userId: UserId;

  /**
   * A branded number representing a monetary amount in cents.
   * @default undefined
   */
  amount: Cents;
};

export type TypedefBrandedTypesExports = Record<string, never>;

declare const TypedefBrandedTypes: Component<
  TypedefBrandedTypesProps,
  TypedefBrandedTypesExports,
  ""
>;
export default TypedefBrandedTypes;
