import { SvelteComponentTyped } from "svelte";
import type { Props } from "./types";

type $Props = Props;

export type RunesWholePropsImportedProps = $Props;

export default class RunesWholePropsImported extends SvelteComponentTyped<
  RunesWholePropsImportedProps,
  Record<string, any>,
  Record<string, never>
> {}
