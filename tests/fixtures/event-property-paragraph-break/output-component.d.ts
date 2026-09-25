import type { Component } from "svelte";

export type Range = {
  /**
   * First index.
   *
   * Inclusive.
   */
  start: number;
  /** Last index. */
  end: number;
};

export type EventPropertyParagraphBreakProps = {
  /**
   * @default { start: 0, end: 0 }
   */
  range?: Range;

  onselect?: (event: CustomEvent<{
        /**
         * The selected item's id.
         *
         * Stable across re-renders.
         */
        id: string;
        /** The item's position. */
        index: number;
      }>) => void;
};

export type EventPropertyParagraphBreakExports = Record<string, never>;

declare const EventPropertyParagraphBreak: Component<
  EventPropertyParagraphBreakProps,
  EventPropertyParagraphBreakExports,
  ""
>;
export default EventPropertyParagraphBreak;
