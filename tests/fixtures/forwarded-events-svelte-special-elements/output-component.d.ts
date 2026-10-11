import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedEventsSvelteSpecialElementsProps = Record<string, never>;

export type ForwardedEventsSvelteSpecialElementsExports = Record<string, never>;

type $Events = {
  click: WindowEventMap["click"];
  keydown: WindowEventMap["keydown"];
  visibilitychange: DocumentEventMap["visibilitychange"];
};

interface ForwardedEventsSvelteSpecialElementsComponent {
  new (
    options: ComponentConstructorOptions<ForwardedEventsSvelteSpecialElementsProps>
  ): SvelteComponent<ForwardedEventsSvelteSpecialElementsProps, $Events> & ForwardedEventsSvelteSpecialElementsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedEventsSvelteSpecialElementsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedEventsSvelteSpecialElementsProps>): void;
  } & ForwardedEventsSvelteSpecialElementsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedEventsSvelteSpecialElements: ForwardedEventsSvelteSpecialElementsComponent;
export default ForwardedEventsSvelteSpecialElements;
