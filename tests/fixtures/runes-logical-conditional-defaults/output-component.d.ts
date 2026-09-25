import type { Component } from "svelte";

export type RunesLogicalConditionalDefaultsProps = {
  /**
   * Nullish fallback
   * @default defaultSize ?? "md"
   */
  size?: string;

  /**
   * Ternary
   * @default compact ? "…" : "More"
   */
  label?: string;

  /**
   * A long ternary spread over several lines
   * @default compact ? "compact-spacing-with-tight-line-height" : theme === "print" ? "print-friendly-spacing" : "comfortable-spacing"
   */
  tone?: string;

  /**
   * Bindable fallback
   * @default defaultSize || "sm"
   */
  value?: string;
};

export type RunesLogicalConditionalDefaultsExports = Record<string, never>;

declare const RunesLogicalConditionalDefaults: Component<
  RunesLogicalConditionalDefaultsProps,
  RunesLogicalConditionalDefaultsExports,
  "value"
>;
export default RunesLogicalConditionalDefaults;
