import { SvelteComponentTyped } from "svelte";

/**
 * The event detail described once as a named typedef, then reused via `@event`.
 */
export type ChangeDetail = {
  /** The full new set of items. */
  items: string[];
  /** Items added since the last change. */
  added: string[];
  /** Items removed since the last change. */
  removed?: string[];
};

export type DispatchedEventsJsdocPropertiesProps = Record<string, never>;

export default class DispatchedEventsJsdocProperties extends SvelteComponentTyped<
  DispatchedEventsJsdocPropertiesProps,
  {
    /** Will be fired if value has been changed */
    change: CustomEvent<null>;
    /**
     * Fired when the collection changes. The detail carries the up-to-date,
     * well-formed set of items (hyphenated prose must survive verbatim).
     */
    "items:change": CustomEvent<ChangeDetail>;
    /** Snowball event fired when throwing a snowball. */
    snowball: CustomEvent<{
      /** Indicates whether the snowball is tightly packed. */
      isPacked: boolean;
      /** The speed of the snowball in mph. */
      speed: number;
      /** Optional color of the snowball. */
      color?: string;
      /** Optional density with default value. @default 0.9 */
      density?: number;
    }>;
    /** Form submission with value */
    submit: CustomEvent<{ value: string }>;
  },
  Record<string, never>
> {}
