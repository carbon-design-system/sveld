import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default 0
   */
  prop?: number;
}

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  {
    default: { prop: number; doubled: number };
    /** description */
    description: { props: { class?: string } };
  }
> {}
