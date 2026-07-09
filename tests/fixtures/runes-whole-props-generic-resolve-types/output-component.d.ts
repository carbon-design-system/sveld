import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { Props } from "./types";

interface Identifiable {
  id: string;
}

type $Props<T extends Identifiable> = Props<T>;

export type RunesWholePropsGenericResolveTypesProps<T extends Identifiable> = $Props<T>;

export type RunesWholePropsGenericResolveTypesExports = Record<string, never>;

interface RunesWholePropsGenericResolveTypesComponent {
  new <T extends Identifiable>(
    options: ComponentConstructorOptions<RunesWholePropsGenericResolveTypesProps<T>>
  ): SvelteComponent<RunesWholePropsGenericResolveTypesProps<T>> & RunesWholePropsGenericResolveTypesExports;
  <T extends Identifiable>(
    this: void,
    internals: ComponentInternals,
    props: RunesWholePropsGenericResolveTypesProps<T>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesWholePropsGenericResolveTypesProps<T>>): void;
  } & RunesWholePropsGenericResolveTypesExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesWholePropsGenericResolveTypes: RunesWholePropsGenericResolveTypesComponent;
export default RunesWholePropsGenericResolveTypes;
