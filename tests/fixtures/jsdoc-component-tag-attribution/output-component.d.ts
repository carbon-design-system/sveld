import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

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

export type JsdocComponentTagAttributionExports = Record<string, never>;

type $Events<T extends string = string> = {
  /** Fires when the panel closes. */
  close: CustomEvent<null>;
  /**
   * @deprecated Use `toggle`.
   */
  open: CustomEvent<null>;
};

interface JsdocComponentTagAttributionComponent {
  new <T extends string = string>(
    options: ComponentConstructorOptions<JsdocComponentTagAttributionProps<T>>
  ): SvelteComponent<JsdocComponentTagAttributionProps<T>, $Events<T>> & JsdocComponentTagAttributionExports;
  <T extends string = string>(
    this: void,
    internals: ComponentInternals,
    props: JsdocComponentTagAttributionProps<T>
  ): {
    $on?<K extends keyof $Events<T> & string>(type: K, callback: (e: $Events<T>[K]) => void): () => void;
    $set?(props: Partial<JsdocComponentTagAttributionProps<T>>): void;
  } & JsdocComponentTagAttributionExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocComponentTagAttribution: JsdocComponentTagAttributionComponent;
export default JsdocComponentTagAttribution;
