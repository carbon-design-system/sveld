import { SvelteComponentTyped } from "svelte";

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

export default class CemAttributeCollision extends SvelteComponentTyped<
  CemAttributeCollisionProps,
  Record<string, any>,
  Record<string, never>
> {}
