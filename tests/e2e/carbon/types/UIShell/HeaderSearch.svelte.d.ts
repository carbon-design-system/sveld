import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export interface HeaderSearchResult {
  href: string;
  text: string;
  description?: string;
}

type $RestProps = SvelteHTMLElements["input"];

type $Props = {
  /**
   * Specify the search input value
   * @default ""
   */
  value?: string;

  /**
   * Set to `true` to activate and focus the search bar
   * @default false
   */
  active?: boolean;

  /**
   * Obtain a reference to the input HTML element
   * @default null
   */
  ref?: null | HTMLInputElement;

  /**
   * Render a list of search results
   * @default []
   */
  results?: HeaderSearchResult[];

  /**
   * Specify the selected result index
   * @default 0
   */
  selectedResultIndex?: number;

  [key: `data-${string}`]: any;
};

export type HeaderSearchProps = Omit<$RestProps, keyof $Props> & $Props;

export default class HeaderSearch extends SvelteComponentTyped<
  HeaderSearchProps,
  {
    active: CustomEvent<any>;
    inactive: CustomEvent<any>;
    clear: CustomEvent<any>;
    select: CustomEvent<{
      value: string;
      selectedResultIndex: number;
      selectedResult: HeaderSearchResult;
    }>;
    change: WindowEventMap["change"];
    input: WindowEventMap["input"];
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
    keydown: WindowEventMap["keydown"];
  },
  { default: { result: HeaderSearchResult; index: number } }
> {}
