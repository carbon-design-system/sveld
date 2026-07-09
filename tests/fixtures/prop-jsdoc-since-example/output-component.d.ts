import type { Component } from "svelte";

export type PropJsdocSinceExampleProps = {
  /**
   * The accessible label for the button.
   * @since 1.4.0
   * @example
   *  ```svelte
   *  <Button label="Save" />
   *  ```
   * @default "Click"
   */
  label?: string;

  /**
   * Visual size token.
   * @since 0.9.0
   * @default "md"
   */
  size?: string;
};

export type PropJsdocSinceExampleExports = Record<string, never>;

declare const PropJsdocSinceExample: Component<
  PropJsdocSinceExampleProps,
  PropJsdocSinceExampleExports,
  ""
>;
export default PropJsdocSinceExample;
