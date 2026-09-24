import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { AccordionSkeletonProps } from "./AccordionSkeleton.svelte";

export type AccordionContext = {
  disableItems: any;
};

type $RestProps = SvelteHTMLElements["ul"];

type $Props = {
  /**
   * Specify alignment of accordion item chevron icon
   * @default "end"
   */
  align?: "start" | "end";

  /**
   * Specify the size of the accordion
   * @default undefined
   */
  size?: "sm" | "xl";

  /**
   * Set to `true` to disable the accordion
   * @default false
   */
  disabled?: boolean;

  /**
   * Set to `true` to display the skeleton state
   * @default false
   */
  skeleton?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type AccordionProps = Omit<$RestProps, keyof ($Props & AccordionSkeletonProps)> & Omit<AccordionSkeletonProps, keyof $Props> & $Props;

/**
 * @example
 * <Accordion>
 *   <AccordionItem>...</AccordionItem>
 * </Accordion>
 */
export default class Accordion extends SvelteComponentTyped<
  AccordionProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
