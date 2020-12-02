/// <reference types="svelte" />

import { SvelteComponentTyped } from "svelte";

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

export default class Header extends SvelteComponentTyped<
  HeaderProps,
  {
    load: CustomEvent<{ ts: number }>;
    click: WindowEventMap["click"];
  },
  {
    default: { prop: 4 };
  }
> {}
