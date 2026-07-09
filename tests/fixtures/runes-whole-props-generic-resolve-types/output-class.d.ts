import { SvelteComponentTyped } from "svelte";
import type { Props } from "./types";

interface Identifiable {
  id: string;
}

type $Props<T extends Identifiable> = Props<T>;

export type RunesWholePropsGenericResolveTypesProps<T extends Identifiable> = $Props<T>;

export default class RunesWholePropsGenericResolveTypes<T extends Identifiable> extends SvelteComponentTyped<
  RunesWholePropsGenericResolveTypesProps<T>,
  Record<string, any>,
  Record<string, never>
> {}
