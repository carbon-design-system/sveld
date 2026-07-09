import type { Component } from "svelte";

interface Props {
  item: string;
  disabled?: boolean;
  children?: import("svelte").Snippet<[props: { item: string }]>;
}

type $Props = Props;

export type RunesWholePropsTypedProps = $Props;

export type RunesWholePropsTypedExports = Record<string, never>;

declare const RunesWholePropsTyped: Component<
  RunesWholePropsTypedProps,
  RunesWholePropsTypedExports,
  ""
>;
export default RunesWholePropsTyped;
