import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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
};

export type JsdocInternalIgnoreExports = Record<string, never>;

type $Events = {
  /** Fired when the value changes. */
  change: CustomEvent<{ value: string }>;
  /** Fired for internal diagnostics only. */
  debug: CustomEvent<{ reason: string }>;
};

interface JsdocInternalIgnoreComponent {
  new (
    options: ComponentConstructorOptions<JsdocInternalIgnoreProps>
  ): SvelteComponent<JsdocInternalIgnoreProps, $Events> & JsdocInternalIgnoreExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocInternalIgnoreProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocInternalIgnoreProps>): void;
  } & JsdocInternalIgnoreExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocInternalIgnore: JsdocInternalIgnoreComponent;
export default JsdocInternalIgnore;
