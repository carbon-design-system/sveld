import { SvelteComponentTyped } from "svelte";

/**
 * @deprecated Use `Size`.
 */
export type OldSize = "sm" | "lg";

export type JsdocComponentTagAttributionProps<T extends string = string> = {
  /**
   * @default "sm"
   */
  size?: string;

  /**
   * Label for the panel.
   * @default ""
   */
  label?: string;

  footer?: (this: void) => void;

  sized?: (this: void, ...args: [{ size: OldSize }]) => void;
};

export default class JsdocComponentTagAttribution<T extends string = string> extends SvelteComponentTyped<
  JsdocComponentTagAttributionProps<T>,
  {
    /** Fires when the panel closes. */
    close: CustomEvent<null>;
    /**
     * @deprecated Use `toggle`.
     */
    open: CustomEvent<null>;
  },
  {
    footer: Record<string, never>;
    sized: { size: OldSize };
  }
> {}
