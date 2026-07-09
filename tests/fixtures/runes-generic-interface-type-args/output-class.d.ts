import { SvelteComponentTyped } from "svelte";

interface Props<T> {
  value: T;
  onchange?: (v: T) => void;
}

type $Props = Props<string>;

export type RunesGenericInterfaceTypeArgsProps = $Props;

export default class RunesGenericInterfaceTypeArgs extends SvelteComponentTyped<
  RunesGenericInterfaceTypeArgsProps,
  Record<string, any>,
  Record<string, never>
> {}
