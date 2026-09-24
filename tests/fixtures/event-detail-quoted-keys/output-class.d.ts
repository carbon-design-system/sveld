import { SvelteComponentTyped } from "svelte";

export type Attributes = {
  /** The element's data id. */
  "data-id": string;
  "aria-hidden": boolean;
};

export type EventDetailQuotedKeysProps = Record<string, never>;

export default class EventDetailQuotedKeys extends SvelteComponentTyped<
  EventDetailQuotedKeysProps,
  {
    change: CustomEvent<{
        "a-b": number;
        ok: boolean;
        "3": string;
        "with space": string;
      }>;
    select: CustomEvent<{
        /** The selected item's id. */
        "item-id": string;
        index?: number;
      }>;
  },
  Record<string, never>
> {}
