import type { Component } from "svelte";

export type UserConfig = {
  /** User identifier */
  id: string;
  /** User display name */
  name: string;
};

export type ThemeConfig = {
  /** Theme identifier */
  id: string;
  /** Theme display name */
  name: string;
};

export type MultipleTypedefSamePropertyProps = {
  /**
   * @default { id: "1", name: "Admin" }
   */
  user?: UserConfig;

  /**
   * @default { id: "default", name: "Default" }
   */
  theme?: ThemeConfig;
};

export type MultipleTypedefSamePropertyExports = Record<string, never>;

declare const MultipleTypedefSameProperty: Component<
  MultipleTypedefSamePropertyProps,
  MultipleTypedefSamePropertyExports,
  ""
>;
export default MultipleTypedefSameProperty;
