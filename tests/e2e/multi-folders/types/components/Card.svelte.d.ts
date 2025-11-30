import { SvelteComponentTyped } from "svelte";

export type CardProps = Record<string, never>;

export default class Card extends SvelteComponentTyped<
  CardProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
