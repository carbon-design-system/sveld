import type { Component } from "svelte";

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

export type RunesPropJsdocSinceExampleExports = Record<string, never>;

declare const RunesPropJsdocSinceExample: Component<
  RunesPropJsdocSinceExampleProps,
  RunesPropJsdocSinceExampleExports,
  ""
>;
export default RunesPropJsdocSinceExample;
