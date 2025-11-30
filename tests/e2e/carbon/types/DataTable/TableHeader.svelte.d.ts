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
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  [key: `data-${string}`]: any;
};

export type TableHeaderProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TableHeader extends SvelteComponentTyped<
  TableHeaderProps,
  {
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    click: WindowEventMap["click"];
  },
  { default: Record<string, never> }
> {}
