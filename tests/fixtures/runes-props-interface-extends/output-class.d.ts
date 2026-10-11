import { SvelteComponentTyped } from "svelte";

interface Identified<Id> {
  /** Unique id. */
  id: Id;
  /** Shown when `label` is empty. */
  fallback?: string;
}

interface Labeled {
  label?: string;
}

interface Props extends Identified<number>, Labeled {
  /** Overrides the inherited docs. */
  fallback?: string;
}

type $Props = Props;

export type RunesPropsInterfaceExtendsProps = $Props;

export default class RunesPropsInterfaceExtends extends SvelteComponentTyped<
  RunesPropsInterfaceExtendsProps,
  Record<string, any>,
  Record<string, never>
> {}
