import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["th"];

type $Props = {
  /**
   * Specify the `scope` attribute
   * @default "col"
   */
  scope?: string;

  /**
   * Override the default id translations
   */
  translateWithId?: () => string;

  /**
   * Set an id for the top-level element
   * @default `ccs-${Math.random().toString(36)}`
   */
  id?: string;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type TableHeaderProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TableHeader extends SvelteComponentTyped<
  TableHeaderProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
