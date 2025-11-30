import { SvelteComponentTyped } from "svelte";

export type HeaderProps = Record<string, never>;

export default class Header extends SvelteComponentTyped<
  HeaderProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
