import { SvelteComponentTyped } from "svelte";

interface Props {
  /** The item to show. */
  item: string;
  disabled?: boolean;
  onclick?: (event: MouseEvent) => void;
  /** @internal */
  secret?: string;
  /** @deprecated Use `disabled`. */
  inactive?: boolean;
  children?: import("svelte").Snippet<[props: { item: string }]>;
}

type $Props = Props;

export type RunesWholePropsTypedProps = $Props;

export default class RunesWholePropsTyped extends SvelteComponentTyped<
  RunesWholePropsTypedProps,
  Record<string, any>,
  { default: { item: string } }
> {}
