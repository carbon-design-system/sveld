import type { Component } from "svelte";

export type SlotDescriptionHyphensProseProps = {
  /** Bind row-id and column-id so drag-and-drop works across multi-pane layouts. */
  children?: (this: void, ...args: [{
        row: string;
        column: string
      }]) => void;
};

export type SlotDescriptionHyphensProseExports = Record<string, never>;

declare const SlotDescriptionHyphensProse: Component<
  SlotDescriptionHyphensProseProps,
  SlotDescriptionHyphensProseExports,
  ""
>;
export default SlotDescriptionHyphensProse;
