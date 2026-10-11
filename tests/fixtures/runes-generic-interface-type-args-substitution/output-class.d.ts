import { SvelteComponentTyped } from "svelte";

interface Props<T, U extends unknown[], F> {
  values: T[];
  tuple: [...U, T];
  label: `T-${T & string}`;
  callback: F | null;
}

type $Props = Props<"a" | "b", [number], () => void>;

export type RunesGenericInterfaceTypeArgsSubstitutionProps = $Props;

export default class RunesGenericInterfaceTypeArgsSubstitution extends SvelteComponentTyped<
  RunesGenericInterfaceTypeArgsSubstitutionProps,
  Record<string, any>,
  Record<string, never>
> {}
