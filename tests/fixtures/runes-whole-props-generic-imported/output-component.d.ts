import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { Props } from "./types";

interface Identifiable {
  id: string;
}

type $Props<T extends Identifiable> = Props<T>;

export type RunesWholePropsGenericImportedProps<T extends Identifiable> = $Props<T>;

export type RunesWholePropsGenericImportedExports = Record<string, never>;

interface RunesWholePropsGenericImportedComponent {
  new <T extends Identifiable>(
    options: ComponentConstructorOptions<RunesWholePropsGenericImportedProps<T>>
  ): SvelteComponent<RunesWholePropsGenericImportedProps<T>> & RunesWholePropsGenericImportedExports;
  <T extends Identifiable>(
    this: void,
    internals: ComponentInternals,
    props: RunesWholePropsGenericImportedProps<T>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesWholePropsGenericImportedProps<T>>): void;
  } & RunesWholePropsGenericImportedExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesWholePropsGenericImported: RunesWholePropsGenericImportedComponent;
export default RunesWholePropsGenericImported;
