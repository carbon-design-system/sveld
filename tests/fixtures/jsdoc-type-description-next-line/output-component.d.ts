import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type JsdocTypeDescriptionNextLineProps = {
  /** Header content. */
  header?: (this: void, ...args: [{ title: string }]) => void;

  /** Renders each item. */
  children?: (this: void, ...args: [{ item: string }]) => void;
};

export type JsdocTypeDescriptionNextLineExports = Record<string, never>;

type $Events = {
  /** Fired on change. */
  change: CustomEvent<{ value: string }>;
};

interface JsdocTypeDescriptionNextLineComponent {
  new (
    options: ComponentConstructorOptions<JsdocTypeDescriptionNextLineProps>
  ): SvelteComponent<JsdocTypeDescriptionNextLineProps, $Events> & JsdocTypeDescriptionNextLineExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocTypeDescriptionNextLineProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocTypeDescriptionNextLineProps>): void;
  } & JsdocTypeDescriptionNextLineExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocTypeDescriptionNextLine: JsdocTypeDescriptionNextLineComponent;
export default JsdocTypeDescriptionNextLine;
