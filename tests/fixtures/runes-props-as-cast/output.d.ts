import { SvelteComponentTyped } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
}

type $Props = Props;

export type RunesPropsAsCastProps = $Props;

export default class RunesPropsAsCast extends SvelteComponentTyped<
  RunesPropsAsCastProps,
  Record<string, any>,
  Record<string, never>
> {}
