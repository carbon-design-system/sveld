import type { SvelteComponentTyped } from "svelte";

export interface HeaderProps {}

export default class Header extends SvelteComponentTyped<
  HeaderProps,
  Record<string, any>,
  { default: {} }
> {}
