import type { SvelteComponentTyped } from "svelte";

export type ForwardedStandardEventCustomDetailProps = {
  /**
   * @default []
   */
  files?: [];
};

export default class ForwardedStandardEventCustomDetail extends SvelteComponentTyped<
  ForwardedStandardEventCustomDetailProps,
  {
    add: CustomEvent<ReadonlyArray<File>>;
    remove: CustomEvent<ReadonlyArray<File>>;
    change: CustomEvent<ReadonlyArray<File>>;
  },
  Record<string, never>
> {}
