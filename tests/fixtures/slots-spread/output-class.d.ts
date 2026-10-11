import { SvelteComponentTyped } from "svelte";

export type SlotsSpreadProps = {
  text?: (this: void, ...args: [{ a: 4 }]) => void;

  children?: (this: void, ...args: [{ a: 4 }]) => void;
};

export default class SlotsSpread extends SvelteComponentTyped<
  SlotsSpreadProps,
  Record<string, any>,
  {
    default: { a: 4 };
    text: { a: 4 };
  }
> {}
