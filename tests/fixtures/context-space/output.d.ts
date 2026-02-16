import { SvelteComponentTyped } from "svelte";

export type MyContextContext = {
  /** Toggle visibility */
  toggle: () => void;
};

export type ContextSpaceProps = Record<string, never>;

export default class ContextSpace extends SvelteComponentTyped<
  ContextSpaceProps,
  Record<string, any>,
  Record<string, never>
> {}
