import { SvelteComponentTyped } from "svelte";
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

  children?: (
    this: void,
    ...args: [{ result: HeaderSearchResult; index: number }]
  ) => void;

  [key: `data-${string}`]: unknown;
};

export type HeaderSearchProps = Omit<$RestProps, keyof $Props> & $Props;

export default class HeaderSearch extends SvelteComponentTyped<
  HeaderSearchProps,
  {
    active: CustomEvent<any>;
    blur: WindowEventMap["blur"];
    change: WindowEventMap["change"];
    clear: CustomEvent<any>;
    focus: WindowEventMap["focus"];
    inactive: CustomEvent<any>;
    input: WindowEventMap["input"];
    keydown: WindowEventMap["keydown"];
    select: CustomEvent<{
      value: string;
      selectedResultIndex: number;
      selectedResult: HeaderSearchResult;
    }>;
  },
  { default: { result: HeaderSearchResult; index: number } }
> {}
