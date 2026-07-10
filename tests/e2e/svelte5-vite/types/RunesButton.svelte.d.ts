import type { Component } from "svelte";
import type { Snippet } from "svelte";

type $Props = {
  label: string;
  onclick?: (event: MouseEvent) => void;
  onpress?: (value: string) => void;
  value?: string;
  children?: Snippet<[{ value: string }]>;
};

export type RunesButtonProps = $Props;

export type RunesButtonExports = Record<string, never>;

declare const RunesButton: Component<
  RunesButtonProps,
  RunesButtonExports,
  "value"
>;
export default RunesButton;
