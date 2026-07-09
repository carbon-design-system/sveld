import { SvelteComponentTyped } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
}

type $Props = Props;

export type RunesPropsSatisfiesCastProps = $Props;

export default class RunesPropsSatisfiesCast extends SvelteComponentTyped<
  RunesPropsSatisfiesCastProps,
  Record<string, any>,
  Record<string, never>
> {}
