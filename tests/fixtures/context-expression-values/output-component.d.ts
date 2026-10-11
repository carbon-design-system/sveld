import type { Component } from "svelte";

export type GroupContext = {
  size: string;
  label: string;
  id: string;
  inherited: any;
};

export type ContextExpressionValuesProps = {
  /**
   * @default false
   */
  dense?: boolean;

  children?: (this: void) => void;
};

export type ContextExpressionValuesExports = Record<string, never>;

declare const ContextExpressionValues: Component<
  ContextExpressionValuesProps,
  ContextExpressionValuesExports,
  ""
>;
export default ContextExpressionValues;
