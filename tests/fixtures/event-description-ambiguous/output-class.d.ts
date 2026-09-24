import { SvelteComponentTyped } from "svelte";

export type EventDescriptionAmbiguousProps = Record<string, never>;

export default class EventDescriptionAmbiguous extends SvelteComponentTyped<
  EventDescriptionAmbiguousProps,
  {
    /** Fired when the menu loses focus. */
    blur: CustomEvent<null>;
    /** Fired when the user selects an item. */
    clear: CustomEvent<null>;
    close: CustomEvent<null>;
    /** Fired when the menu gains focus. */
    focus: CustomEvent<null>;
    /** Fired when the menu opens. */
    open: CustomEvent<{ value: string }>;
    select: CustomEvent<{ value: string }>;
  },
  Record<string, never>
> {}
