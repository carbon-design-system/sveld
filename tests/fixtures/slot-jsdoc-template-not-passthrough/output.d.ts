import { SvelteComponentTyped } from "svelte";

export type SlotJsdocTemplateNotPassthroughProps = {
  /** Body slot uses a generic from `@template`; that tag must not appear on the slot in output. */
  body?: (this: void, ...args: [{ n: number }]) => void;
};

export default class SlotJsdocTemplateNotPassthrough extends SvelteComponentTyped<
  SlotJsdocTemplateNotPassthroughProps,
  Record<string, any>,
  {
    /** Body slot uses a generic from `@template`; that tag must not appear on the slot in output. */
    body: { n: number };
  }
> {}
