import { SvelteComponentTyped } from "svelte";

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
  children?: (this: void, ...args: [{ props?: { "aria-current"?: string; class: "bx--link" } }]) => void;
};

export default class SlotJsdocExample extends SvelteComponentTyped<
  SlotJsdocExampleProps,
  Record<string, any>,
  {
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
    default: { props?: { "aria-current"?: string; class: "bx--link" } };
  }
> {}
