import type { SvelteComponentTyped } from "svelte";

export type ForwardedNativeWithDetailProps = {};

export default class ForwardedNativeWithDetail extends SvelteComponentTyped<
  ForwardedNativeWithDetailProps,
  {
    /** The input value when changed */ change: CustomEvent<string>;
  },
  {}
> {}
