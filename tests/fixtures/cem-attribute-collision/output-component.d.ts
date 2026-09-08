import type { Component } from "svelte";

export type CemAttributeCollisionProps = {
  /**
   * Lowercase value.
   * @default ""
   */
  value?: string;

  /**
   * Capitalized value collides with `value` on the attribute name.
   * @default ""
   */
  Value?: string;
};

export type CemAttributeCollisionExports = Record<string, never>;

declare const CemAttributeCollision: Component<
  CemAttributeCollisionProps,
  CemAttributeCollisionExports,
  ""
>;
export default CemAttributeCollision;
