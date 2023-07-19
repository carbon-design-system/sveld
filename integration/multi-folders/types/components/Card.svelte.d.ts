import type { SvelteComponentTyped } from "svelte";

export interface CardProps {}

export default class Card extends SvelteComponentTyped<
  CardProps,
  Record<string, any>,
  { default: {} }
> {}
