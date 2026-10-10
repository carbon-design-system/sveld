import { SvelteComponentTyped } from "svelte";
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

export default class CastDefaults extends SvelteComponentTyped<
  CastDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
