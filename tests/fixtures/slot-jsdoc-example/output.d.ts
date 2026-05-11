import { SvelteComponentTyped } from "svelte";

export type SlotJsdocExampleProps = {
  /**
   * ```svelte
   * <BreadcrumbItem let:props>
   * <a {...props} href="/">Home</a>
   * </BreadcrumbItem>
   * ```
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
     * ```svelte
     * <BreadcrumbItem let:props>
     * <a {...props} href="/">Home</a>
     * </BreadcrumbItem>
     * ```
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
