import { SvelteComponentTyped } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
  children?: import("svelte").Snippet<[props: { item: string }]>;
}

type $Props = Props;

export type RunesWholePropsTypedProps = $Props;

export default class RunesWholePropsTyped extends SvelteComponentTyped<
  RunesWholePropsTypedProps,
  Record<string, any>,
  { default: { item: string } }
> {}
