import { SvelteComponentTyped } from "svelte";

export type EventJsdocSinceProps = {
  /**
   * @default ""
   */
  value?: string;
};

export default class EventJsdocSince extends SvelteComponentTyped<
  EventJsdocSinceProps,
  {
    /**
     * Fired when the value changes.
     * @since 1.1.0
     * @example
     *  ```svelte
     *  <Field on:change={(e) => console.log(e.detail)} />
     *  ```
     */
    change: CustomEvent<string>;
  },
  Record<string, never>
> {}
