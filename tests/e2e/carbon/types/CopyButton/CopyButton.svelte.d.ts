import { SvelteComponentTyped } from "svelte";
import type { CopyProps } from "../Copy/Copy.svelte";

type $Props = {
  /**
   * Set the title and ARIA label for the copy button
   * @default "Copy to clipboard"
   */
  iconDescription?: string;
};

export type CopyButtonProps = Omit<CopyProps, keyof $Props> & $Props;

export default class CopyButton extends SvelteComponentTyped<
  CopyButtonProps,
  {
    animationend: WindowEventMap["animationend"];
    click: WindowEventMap["click"];
  },
  Record<string, never>
> {}
