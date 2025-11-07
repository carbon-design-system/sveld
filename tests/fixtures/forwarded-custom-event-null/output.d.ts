import type { SvelteComponentTyped } from "svelte";

export type ForwardedCustomEventNullProps = {};

export default class ForwardedCustomEventNull extends SvelteComponentTyped<
  ForwardedCustomEventNullProps,
  {
    /** Clear button clicked with no data */ clear: CustomEvent<null>;
    /** Search query changed */
    search: CustomEvent<string>;
  },
  {}
> {}
