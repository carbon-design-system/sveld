import { SvelteComponentTyped } from "svelte";

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
};

export default class EventPropertyParagraphBreak extends SvelteComponentTyped<
  EventPropertyParagraphBreakProps,
  {
    select: CustomEvent<{
        /**
         * The selected item's id.
         *
         * Stable across re-renders.
         */
        id: string;
        /** The item's position. */
        index: number;
      }>;
  },
  Record<string, never>
> {}
