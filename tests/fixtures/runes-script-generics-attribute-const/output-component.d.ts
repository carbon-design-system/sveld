import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

type $Props<T extends readonly string[]> = { items: T } & {
  children?: (this: void) => void;
};

export type RunesScriptGenericsAttributeConstProps<T extends readonly string[]> = $Props<T>;

export type RunesScriptGenericsAttributeConstExports = Record<string, never>;

interface RunesScriptGenericsAttributeConstComponent {
  new <const T extends readonly string[]>(
    options: ComponentConstructorOptions<RunesScriptGenericsAttributeConstProps<T>>
  ): SvelteComponent<RunesScriptGenericsAttributeConstProps<T>> & RunesScriptGenericsAttributeConstExports;
  <const T extends readonly string[]>(
    this: void,
    internals: ComponentInternals,
    props: RunesScriptGenericsAttributeConstProps<T>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesScriptGenericsAttributeConstProps<T>>): void;
  } & RunesScriptGenericsAttributeConstExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesScriptGenericsAttributeConst: RunesScriptGenericsAttributeConstComponent;
export default RunesScriptGenericsAttributeConst;
