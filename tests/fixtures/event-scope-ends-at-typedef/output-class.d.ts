import { SvelteComponentTyped } from "svelte";

/**
 * Options desc
 * continued unindented.
 */
export type Options = {
  /** Label desc. */
  label: string;
};

export type EventScopeEndsAtTypedefProps = {
  /**
   * Options desc
   * continued unindented.
   * @default { label: "" }
   */
  options?: Options;

  /**
   * Footer desc
   * continued footer.
   */
  footer?: (this: void) => void;
};

export default class EventScopeEndsAtTypedef extends SvelteComponentTyped<
  EventScopeEndsAtTypedefProps,
  {
    /** Go desc. */
    go: CustomEvent<null>;
  },
  {
    /**
     * Footer desc
     * continued footer.
     */
    footer: Record<string, never>;
  }
> {}
