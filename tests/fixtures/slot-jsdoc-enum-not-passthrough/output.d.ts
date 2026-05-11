import { SvelteComponentTyped } from "svelte";

export type SlotJsdocEnumNotPassthroughProps = {
  /** `@enum` shares blocks with typedefs/slots in some codebases; it must not attach to the slot. */
  item?: (this: void, ...args: [{ id: string }]) => void;
};

export default class SlotJsdocEnumNotPassthrough extends SvelteComponentTyped<
  SlotJsdocEnumNotPassthroughProps,
  Record<string, any>,
  {
    /** `@enum` shares blocks with typedefs/slots in some codebases; it must not attach to the slot. */
    item: { id: string };
  }
> {}
