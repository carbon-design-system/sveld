import type { SvelteComponentTyped } from "svelte";
import type { AccordionSkeletonProps } from "./AccordionSkeleton.svelte";

export type AccordionProps = AccordionSkeletonProps & {
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
};

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
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
