import { SvelteComponentTyped } from "svelte";

export type ForwardedNativeWithDetailProps = Record<string, never>;

export default class ForwardedNativeWithDetail extends SvelteComponentTyped<
  ForwardedNativeWithDetailProps,
  {
    /** The input value when changed */
    change: CustomEvent<string>;
  },
  Record<string, never>
> {}
