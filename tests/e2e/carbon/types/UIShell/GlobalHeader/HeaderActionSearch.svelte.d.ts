import { SvelteComponentTyped } from "svelte";

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
    focusInputSearch: CustomEvent<null>;
    focusOutInputSearch: CustomEvent<null>;
    inputSearch: CustomEvent<{ action: "search"; textInput: string }>;
  },
  Record<string, never>
> {}
