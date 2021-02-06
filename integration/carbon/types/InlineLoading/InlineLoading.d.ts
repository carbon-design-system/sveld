/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InlineLoadingProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["div"]> {
  /**
   * Set the loading status
   * @default "active"
   */
  status?: "active" | "inactive" | "finished" | "error";

  /**
   * Set the loading description
   */
  description?: string;

  /**
   * Specify the ARIA label for the loading icon
   */
  iconDescription?: string;

  /**
   * Specify the timeout delay (ms) after `status` is set to "success"
   * @default 1500
   */
  successDelay?: number;
}

export default class InlineLoading extends SvelteComponentTyped<
  InlineLoadingProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    success: CustomEvent<any>;
  },
  {}
> {}
