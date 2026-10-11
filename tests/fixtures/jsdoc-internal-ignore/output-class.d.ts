import { SvelteComponentTyped } from "svelte";

/**
 * Public module export.
 */
export declare const PUBLIC_CONST: number;

export interface PublicLabel {
  label: string
}

export type JsdocInternalIgnoreProps = {
  /**
   * The visible label.
   * @default ""
   */
  label?: string;

  /** Badge content rendered next to the label. */
  badge?: (this: void, ...args: [{ count: number }]) => void;
};

export default class JsdocInternalIgnore extends SvelteComponentTyped<
  JsdocInternalIgnoreProps,
  {
    /** Fired when the value changes. */
    change: CustomEvent<{ value: string }>;
  },
  {
    /** Badge content rendered next to the label. */
    badge: { count: number };
  }
> {}
