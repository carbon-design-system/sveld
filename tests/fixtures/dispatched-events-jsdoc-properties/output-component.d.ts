import type { Component } from "svelte";

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

export type DispatchedEventsJsdocPropertiesProps = {
  /** Will be fired if value has been changed */
  onchange?: (event: CustomEvent<null>) => void;

  /**
   * Fired when the collection changes. The detail carries the up-to-date,
   * well-formed set of items (hyphenated prose must survive verbatim).
   */
  "onitems:change"?: (event: CustomEvent<ChangeDetail>) => void;

  /** Snowball event fired when throwing a snowball. */
  onsnowball?: (event: CustomEvent<{
        /** Indicates whether the snowball is tightly packed. */
        isPacked: boolean;
        /** The speed of the snowball in mph. */
        speed: number;
        /** Optional color of the snowball. */
        color?: string;
        /** Optional density with default value. @default 0.9 */
        density?: number;
      }>) => void;

  /** Form submission with value */
  onsubmit?: (event: CustomEvent<{ value: string }>) => void;
};

export type DispatchedEventsJsdocPropertiesExports = Record<string, never>;

declare const DispatchedEventsJsdocProperties: Component<
  DispatchedEventsJsdocPropertiesProps,
  DispatchedEventsJsdocPropertiesExports,
  ""
>;
export default DispatchedEventsJsdocProperties;
