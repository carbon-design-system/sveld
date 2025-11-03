import type { SvelteComponentTyped } from "svelte";

export type HeaderActionSearchProps = {
  /**
   * Set to `true` to focus the search
   * @default false
   */
  searchIsActive?: boolean;
};

export default class HeaderActionSearch extends SvelteComponentTyped<
  HeaderActionSearchProps,
  {
    inputSearch: CustomEvent<{ action: "search"; textInput: string }>;
    focusInputSearch: CustomEvent<null>;
    focusOutInputSearch: CustomEvent<null>;
  },
  Record<string, never>
> {}
