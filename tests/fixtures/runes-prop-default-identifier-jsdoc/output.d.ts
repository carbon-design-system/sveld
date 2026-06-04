import { SvelteComponentTyped } from "svelte";

export type RunesPropDefaultIdentifierJsdocProps = {
  /**
   * Override the default copy behavior of using the navigator.clipboard.writeText API to copy text.
   */
  copy?: (text: string) => void | Promise<void>;

  /**
   * Default size in pixels.
   * @default 16
   */
  size?: number;

  /**
   * Animation configuration applied on mount.
   * @default { duration: 200, easing: "ease-in-out" }
   */
  config?: { duration: number; easing: string };

  /**
   * Fallback label shown when none is provided.
   * @default "Submit"
   */
  label?: string;
};

export default class RunesPropDefaultIdentifierJsdoc extends SvelteComponentTyped<
  RunesPropDefaultIdentifierJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
