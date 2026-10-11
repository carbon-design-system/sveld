import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type JsdocInternalIgnoreExports = Record<string, never>;

type $Events = {
  /** Fired when the value changes. */
  change: CustomEvent<{ value: string }>;
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
