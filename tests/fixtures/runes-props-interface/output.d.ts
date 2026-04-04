import { SvelteComponentTyped } from "svelte";

interface Props {
  foo: string;
  bar?: number;
}

type $Props = Props;

export type RunesPropsInterfaceProps = $Props;

export default class RunesPropsInterface extends SvelteComponentTyped<
  RunesPropsInterfaceProps,
  Record<string, any>,
  Record<string, never>
> {}
