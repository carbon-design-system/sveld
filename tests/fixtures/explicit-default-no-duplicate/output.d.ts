import { SvelteComponentTyped } from "svelte";

export type ExplicitDefaultNoDuplicateProps = {
  /**
   * Custom filter function.
   * @default () => true
   */
  shouldFilter?: (item: string, value: string) => boolean;

  /**
   * Prop with only an inferred default.
   * @default "world"
   */
  name?: string;

  /**
   * Prop with explicit @default matching the initializer.
   * @default false
   */
  disabled?: boolean;

  /**
   * Prop with identifier default, no explicit annotation.
   * Should resolve to the actual value.
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Number of items to display.
   * @default 10
   */
  count?: number;

  /**
   * Click handler.
   */
  onClick?: (e: MouseEvent) => void;

  /**
   * Component configuration.
   * @default { theme: "dark", density: "compact" }
   */
  config?: { theme: string; density: string };

  /**
   * List of items.
   * @default ["a", "b", "c"]
   */
  items?: ["a", "b", "c"];

  /**
   * Starting offset.
   * @default -1
   */
  offset?: number;
};

export default class ExplicitDefaultNoDuplicate extends SvelteComponentTyped<
  ExplicitDefaultNoDuplicateProps,
  Record<string, any>,
  Record<string, never>
> {}
