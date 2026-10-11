import { SvelteComponentTyped } from "svelte";

/**
 * A size token.
 */
export type Size = "sm" | "lg";

export type Props = {
  /** Card title */
  title: string;
  /** Elevated look @default false */
  elevated?: boolean;
  /** Click handler */
  onclick?: (e: MouseEvent) => void;
  size?: Size;
};

export type RunesPropsJsdocTypedefProps = {
  /**
   * Card title
   */
  title: string;

  /**
   * Elevated look
   * @default false
   */
  elevated?: boolean;

  /**
   * Click handler
   */
  onclick?: (e: MouseEvent) => void;

  /**
   * A size token.
   * @default "sm"
   */
  size?: Size;
};

export default class RunesPropsJsdocTypedef extends SvelteComponentTyped<
  RunesPropsJsdocTypedefProps,
  Record<string, any>,
  Record<string, never>
> {}
