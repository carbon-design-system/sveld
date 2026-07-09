import { SvelteComponentTyped } from "svelte";

export type SlotDescriptionHyphensProseProps = {
  /** Bind row-id and column-id so drag-and-drop works across multi-pane layouts. */
  children?: (this: void, ...args: [{
        row: string;
        column: string
      }]) => void;
};

export default class SlotDescriptionHyphensProse extends SvelteComponentTyped<
  SlotDescriptionHyphensProseProps,
  Record<string, any>,
  {
    /** Bind row-id and column-id so drag-and-drop works across multi-pane layouts. */
    default: {
      row: string;
      column: string
    };
  }
> {}
