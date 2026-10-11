import type { Component } from "svelte";

export type SlotPropExpressionValuesProps = {
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
        static: "text";
      }]) => void;
};

export type SlotPropExpressionValuesExports = Record<string, never>;

declare const SlotPropExpressionValues: Component<
  SlotPropExpressionValuesProps,
  SlotPropExpressionValuesExports,
  ""
>;
export default SlotPropExpressionValues;
