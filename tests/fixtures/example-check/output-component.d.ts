import type { Component } from "svelte";

export type ExampleCheckProps = {
  /**
   * Svelte example, not TS/JS. sveld skips it.
   * @example
   *  ```svelte
   *  <Widget prop={doesNotExist} />
   *  ```
   * @default "unused"
   */
  widgetSlot?: string;
};

export type ExampleCheckExports = {
  /**
   * Formats a value. Its example is valid and should compile cleanly.
   * @example
   *  ```js
   *  formatValue("ok");
   *  ```
   */
  formatValue: (value: string) => string;

  /**
   * Renamed from `oldFormatName`; the example below was never updated and
   * still calls the old, now-nonexistent name.
   * @example
   *  ```js
   *  oldFormatName("ok");
   *  ```
   */
  newFormatName: (value: string) => string;

  /**
   * Its example calls it with more arguments than it declares.
   * @example
   *  ```js
   *  tooManyArgs("a", "b", "c");
   *  ```
   */
  tooManyArgs: (value: string) => string;
};

declare const ExampleCheck: Component<
  ExampleCheckProps,
  ExampleCheckExports,
  ""
>;
export default ExampleCheck;
