/// <reference types="svelte" />

import { SvelteComponent } from "svelte";

export interface HeaderProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["header"]> {
  /**
   * @default "Header"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;
}

export default class Header extends SvelteComponent<
  HeaderProps,
  {
    load: CustomEvent<{ ts: number }>;
    click: WindowEventMap["click"];
  },
  {
    default: { prop: 4 };
  }
> {}
