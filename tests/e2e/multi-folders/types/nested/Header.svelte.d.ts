import { SvelteComponentTyped } from "svelte";

export type HeaderProps = {
  children?: (this: void) => void;
};

export default class Header extends SvelteComponentTyped<
  HeaderProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
