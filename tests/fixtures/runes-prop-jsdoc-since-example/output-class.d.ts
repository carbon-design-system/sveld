import { SvelteComponentTyped } from "svelte";

export type RunesPropJsdocSinceExampleProps = {
  /**
   * Whether the disclosure is open.
   * @since 2.0.0
   * @example
   *  ```svelte
   *  <Disclosure open />
   *  ```
   * @default false
   */
  open?: boolean;

  children?: (this: void) => void;
};

export default class RunesPropJsdocSinceExample extends SvelteComponentTyped<
  RunesPropJsdocSinceExampleProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
