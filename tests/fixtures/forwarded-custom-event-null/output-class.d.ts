import { SvelteComponentTyped } from "svelte";

export type ForwardedCustomEventNullProps = Record<string, never>;

export default class ForwardedCustomEventNull extends SvelteComponentTyped<
  ForwardedCustomEventNullProps,
  {
    /** Clear button clicked with no data */
    clear: CustomEvent<null>;
    /** Search query changed */
    search: CustomEvent<string>;
  },
  Record<string, never>
> {}
