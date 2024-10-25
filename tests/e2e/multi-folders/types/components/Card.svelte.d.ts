import type { SvelteComponentTyped } from "svelte";

export type CardProps = {};

export default class Card extends SvelteComponentTyped<
  CardProps,
  Record<string, any>,
  { default: {} }
> {}
