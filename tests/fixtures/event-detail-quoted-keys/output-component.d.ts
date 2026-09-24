import type { Component } from "svelte";

export type Attributes = {
  /** The element's data id. */
  "data-id": string;
  "aria-hidden": boolean;
};

export type EventDetailQuotedKeysProps = {
  onchange?: (event: CustomEvent<{
        "a-b": number;
        ok: boolean;
        "3": string;
        "with space": string;
      }>) => void;

  onselect?: (event: CustomEvent<{
        /** The selected item's id. */
        "item-id": string;
        index?: number;
      }>) => void;
};

export type EventDetailQuotedKeysExports = Record<string, never>;

declare const EventDetailQuotedKeys: Component<
  EventDetailQuotedKeysProps,
  EventDetailQuotedKeysExports,
  ""
>;
export default EventDetailQuotedKeys;
