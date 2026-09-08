import type { Component } from "svelte";

/**
 * Internal-only module export.
 */
export declare const INTERNAL_CONST: number;

/**
 * Public module export.
 */
export declare const PUBLIC_CONST: number;

export interface InternalCount {
  count: number
}

export interface PublicLabel {
  label: string
}

export type JsdocInternalIgnoreProps = {
  /**
   * The visible label.
   * @default ""
   */
  label?: string;

  /**
   * Internal-only prop, not part of the public API.
   * @default ""
   */
  debugId?: string;

  /**
   * Ignored prop.
   * @default false
   */
  legacyFlag?: boolean;

  /** Badge content rendered next to the label. */
  badge?: (this: void, ...args: [{ count: number }]) => void;

  /** Internal-only slot. */
  "debug-panel"?: (this: void) => void;

  /** Fired when the value changes. */
  onchange?: (event: CustomEvent<{ value: string }>) => void;

  /** Fired for internal diagnostics only. */
  ondebug?: (event: CustomEvent<{ reason: string }>) => void;
};

export type JsdocInternalIgnoreExports = Record<string, never>;

declare const JsdocInternalIgnore: Component<
  JsdocInternalIgnoreProps,
  JsdocInternalIgnoreExports,
  ""
>;
export default JsdocInternalIgnore;
