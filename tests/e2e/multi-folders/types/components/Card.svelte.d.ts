import { SvelteComponentTyped } from "svelte";

export type CardProps = {
  children?: (this: void) => void;
};

export default class Card extends SvelteComponentTyped<
  CardProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
