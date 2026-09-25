import type { Component } from "svelte";

export type LogicalConditionalDefaultsProps = {
  /**
   * Nullish fallback
   * @default defaultSize ?? "md"
   */
  size?: string;

  /**
   * Falsy fallback
   * @default theme || []
   */
  items?: any;

  /**
   * Logical and
   * @default compact && true
   */
  showIcon?: boolean;

  /**
   * Ternary
   * @default compact ? "…" : "More"
   */
  label?: string;

  /**
   * A long ternary spread over several lines
   * @default theme === "dark" ? "light-text-on-dark-background" : theme === "light" ? "dark-text-on-light-background" : "neutral"
   */
  tone?: string;

  /**
   * @default (compact, 42)
   */
  last?: number;

  /**
   * A description that already documents its default
   * @default "md"
   */
  explicit?: string;
};

export type LogicalConditionalDefaultsExports = Record<string, never>;

declare const LogicalConditionalDefaults: Component<
  LogicalConditionalDefaultsProps,
  LogicalConditionalDefaultsExports,
  ""
>;
export default LogicalConditionalDefaults;
