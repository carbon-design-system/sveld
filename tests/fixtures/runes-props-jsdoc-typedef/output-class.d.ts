import { SvelteComponentTyped } from "svelte";

export type Props = {
  /** Card title */
  title: string;
  /** Elevated look @default false */
  elevated?: boolean;
  /** Click handler */
  onclick?: (e: MouseEvent) => void;
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
};

export default class RunesPropsJsdocTypedef extends SvelteComponentTyped<
  RunesPropsJsdocTypedefProps,
  Record<string, any>,
  Record<string, never>
> {}
