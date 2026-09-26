import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedCustomEventNullProps = Record<string, never>;

export type ForwardedCustomEventNullExports = Record<string, never>;

type $Events = {
  /** Clear button clicked with no data */
  clear: CustomEvent<null>;
  /** Search query changed */
  search: CustomEvent<string>;
};

interface ForwardedCustomEventNullComponent {
  new (
    options: ComponentConstructorOptions<ForwardedCustomEventNullProps>
  ): SvelteComponent<ForwardedCustomEventNullProps, $Events> & ForwardedCustomEventNullExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedCustomEventNullProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedCustomEventNullProps>): void;
  } & ForwardedCustomEventNullExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedCustomEventNull: ForwardedCustomEventNullComponent;
export default ForwardedCustomEventNull;
