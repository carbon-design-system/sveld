import type { Component } from "svelte";

export type EventJsdocSinceProps = {
  /**
   * @default ""
   */
  value?: string;

  /**
   * Fired when the value changes.
   * @since 1.1.0
   * @example
   *  ```svelte
   *  <Field on:change={(e) => console.log(e.detail)} />
   *  ```
   */
  onchange?: (event: CustomEvent<string>) => void;
};

export type EventJsdocSinceExports = Record<string, never>;

declare const EventJsdocSince: Component<
  EventJsdocSinceProps,
  EventJsdocSinceExports,
  ""
>;
export default EventJsdocSince;
