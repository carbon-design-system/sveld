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
};

export default class ExplicitDefaultNoDuplicate extends SvelteComponentTyped<
  ExplicitDefaultNoDuplicateProps,
  Record<string, any>,
  Record<string, never>
> {}
