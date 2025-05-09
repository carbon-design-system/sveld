import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"] & SvelteHTMLElements["span"];

type $Props = {
  /**
   * Specify the type of tag
   * @default undefined
   */
  type?:
    | "red"
    | "magenta"
    | "purple"
    | "blue"
    | "cyan"
    | "teal"
    | "green"
    | "gray"
    | "cool-gray"
    | "warm-gray"
    | "high-contrast";

  /**
   * Set to `true` to use filterable variant
   * @default false
   */
  filter?: boolean;

  /**
   * Set to `true` to disable a filterable tag
   * @default false
   */
  disabled?: boolean;

  /**
   * Set to `true` to display the skeleton state
   * @default false
   */
  skeleton?: boolean;

  /**
   * Set the title for the close button in a filterable tag
   * @default "Clear filter"
   */
  title?: string;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Set an id for the filterable tag
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  [key: `data-${string}`]: any;
};

export type TagProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Tag extends SvelteComponentTyped<
  TagProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    close: CustomEvent<null>;
  },
  { default: { props: { class: "bx--tag__label" } } }
> {}
