import type { Component } from "svelte";

export type CallExpressionDefaultHoistedFunctionProps = {
  /**
   * @default uniqueId()
   */
  id?: string;
};

export type CallExpressionDefaultHoistedFunctionExports = Record<string, never>;

declare const CallExpressionDefaultHoistedFunction: Component<
  CallExpressionDefaultHoistedFunctionProps,
  CallExpressionDefaultHoistedFunctionExports,
  ""
>;
export default CallExpressionDefaultHoistedFunction;
