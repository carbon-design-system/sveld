import { SvelteComponentTyped } from "svelte";
import type { Props } from "./types";

interface Identifiable {
  id: string;
}

type $Props<T extends Identifiable> = Props<T>;

export type RunesWholePropsGenericImportedProps<T extends Identifiable> = $Props<T>;

export default class RunesWholePropsGenericImported<T extends Identifiable> extends SvelteComponentTyped<
  RunesWholePropsGenericImportedProps<T>,
  Record<string, any>,
  Record<string, never>
> {}
