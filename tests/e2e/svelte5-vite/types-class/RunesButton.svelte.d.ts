import { SvelteComponentTyped } from "svelte";
import type { Snippet } from "svelte";

type $Props = {
  label: string;
  onclick?: (event: MouseEvent) => void;
  onpress?: (value: string) => void;
  value?: string;
  children?: Snippet<[{ value: string }]>;
};

export type RunesButtonProps = $Props;

export default class RunesButton extends SvelteComponentTyped<
  RunesButtonProps,
  Record<string, any>,
  { default: { value: string } }
> {}
