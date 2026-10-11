import { SvelteComponentTyped } from "svelte";

interface Props<T> {
  value: T;
  onchange?: (T: T) => void;
  kind?: "T" | T;
  map?: {
    T: T;
    readonly label: T
  };
}

type $Props = Props<string>;

export type RunesGenericInterfaceTypeArgsProps = $Props;

export default class RunesGenericInterfaceTypeArgs extends SvelteComponentTyped<
  RunesGenericInterfaceTypeArgsProps,
  Record<string, any>,
  Record<string, never>
> {}
