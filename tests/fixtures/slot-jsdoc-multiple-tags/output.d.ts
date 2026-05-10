import { SvelteComponentTyped } from "svelte";

export type SlotJsdocMultipleTagsProps = {
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   * @example
   *  ```svelte
   *  <BreadcrumbItem let:props>
   *    <a {...props} href="/">Home</a>
   *  </BreadcrumbItem>
   *  ```
   * @deprecated Prefer the `link` snippet.
   */
  children?: (this: void, ...args: [{ props?: { "aria-current"?: string; class: "bx--link" } }]) => void;
};

export default class SlotJsdocMultipleTags extends SvelteComponentTyped<
  SlotJsdocMultipleTagsProps,
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
     * @deprecated Prefer the `link` snippet.
     */
    default: { props?: { "aria-current"?: string; class: "bx--link" } };
  }
> {}
