import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadTypedProps = {
  text?: (this: void, ...args: [{ a: number }]) => void;

  children?: (this: void, ...args: [{ a: number }]) => void;
};

export default class SlotsSpreadTyped extends SvelteComponentTyped<
  SlotsSpreadTypedProps,
  Record<string, any>,
  { default: { a: number }; text: { a: number } }
> {}
