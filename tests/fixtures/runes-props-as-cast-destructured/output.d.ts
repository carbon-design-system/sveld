import { SvelteComponentTyped } from "svelte";

type $Props = {
  value: number;
  label?: string
};

export type RunesPropsAsCastDestructuredProps = $Props;

export default class RunesPropsAsCastDestructured extends SvelteComponentTyped<
  RunesPropsAsCastDestructuredProps,
  Record<string, any>,
  Record<string, never>
> {}
