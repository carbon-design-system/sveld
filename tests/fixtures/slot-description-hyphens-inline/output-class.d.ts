import { SvelteComponentTyped } from "svelte";

export type SlotDescriptionHyphensInlineProps = {
  /** Row id maps to server-side UUID v4 (not v1-v3). */
  item?: (this: void, ...args: [{ id: string }]) => void;
};

export default class SlotDescriptionHyphensInline extends SvelteComponentTyped<
  SlotDescriptionHyphensInlineProps,
  Record<string, any>,
  {
    /** Row id maps to server-side UUID v4 (not v1-v3). */
    item: { id: string };
  }
> {}
