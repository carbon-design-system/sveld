import { SvelteComponentTyped } from "svelte";

export type RunesPropsJsdocInlineTypeProps = {
  label: string;

  /**
   * @default "sm"
   */
  size?: "sm" | "lg";
};

export default class RunesPropsJsdocInlineType extends SvelteComponentTyped<
  RunesPropsJsdocInlineTypeProps,
  Record<string, any>,
  Record<string, never>
> {}
