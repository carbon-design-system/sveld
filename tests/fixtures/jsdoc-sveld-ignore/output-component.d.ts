import type { Component } from "svelte";

export type JsdocSveldIgnoreProps = {
  /**
   * Suppresses only the named diagnostic.
   * @default compute()
   */
  ignored?: any;

  /**
   * A bare tag suppresses every diagnostic for the prop.
   * @default compute()
   */
  ignoredAll?: any;

  /**
   * A different code leaves this prop's diagnostic in place.
   * @default compute()
   */
  otherCode?: any;

  /**
   * @default compute()
   */
  reported?: any;
};

export type JsdocSveldIgnoreExports = Record<string, never>;

declare const JsdocSveldIgnore: Component<
  JsdocSveldIgnoreProps,
  JsdocSveldIgnoreExports,
  ""
>;
export default JsdocSveldIgnore;
