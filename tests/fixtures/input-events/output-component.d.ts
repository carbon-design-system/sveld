import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type InputEventsProps = Record<string, never>;

export type InputEventsExports = Record<string, never>;

type $Events = {
  change: WindowEventMap["change"];
  input: WindowEventMap["input"];
  paste: WindowEventMap["paste"];
};

interface InputEventsComponent {
  new (
    options: ComponentConstructorOptions<InputEventsProps>
  ): SvelteComponent<InputEventsProps, $Events> & InputEventsExports;
  (
    this: void,
    internals: ComponentInternals,
    props: InputEventsProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<InputEventsProps>): void;
  } & InputEventsExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const InputEvents: InputEventsComponent;
export default InputEvents;
