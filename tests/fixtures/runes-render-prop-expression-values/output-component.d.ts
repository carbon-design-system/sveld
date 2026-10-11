import type { Component } from "svelte";

export type RunesRenderPropExpressionValuesProps = {
  /**
   * @default ""
   */
  title?: string;

  /**
   * @default 0
   */
  count?: number;

  children?: (this: void, ...args: [{
        heading: string;
        count: number;
        kind: "primary";
        size: 2;
      }]) => void;
};

export type RunesRenderPropExpressionValuesExports = Record<string, never>;

declare const RunesRenderPropExpressionValues: Component<
  RunesRenderPropExpressionValuesProps,
  RunesRenderPropExpressionValuesExports,
  ""
>;
export default RunesRenderPropExpressionValues;
