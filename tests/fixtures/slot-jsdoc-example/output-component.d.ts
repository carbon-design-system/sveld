import type { Component } from "svelte";

export type SlotJsdocExampleProps = {
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   * @example
   *  ```svelte
   *  <BreadcrumbItem let:props>
   *    <a {...props} href="/">Home</a>
   *  </BreadcrumbItem>
   *  ```
   */
  children?: (this: void, ...args: [{
        props?: {
          "aria-current"?: string;
          class: "bx--link"
        }
      }]) => void;
};

export type SlotJsdocExampleExports = Record<string, never>;

declare const SlotJsdocExample: Component<
  SlotJsdocExampleProps,
  SlotJsdocExampleExports,
  ""
>;
export default SlotJsdocExample;
