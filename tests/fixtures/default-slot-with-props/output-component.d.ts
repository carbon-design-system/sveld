import type { Component } from "svelte";

export type DefaultSlotWithPropsProps = {
  /**
   * @default []
   */
  items?: string[];

  children?: (this: void, ...args: [{
        item: string;
        index: number;
        isFirst: boolean;
        isLast: boolean;
      }]) => void;
};

export type DefaultSlotWithPropsExports = Record<string, never>;

declare const DefaultSlotWithProps: Component<
  DefaultSlotWithPropsProps,
  DefaultSlotWithPropsExports,
  ""
>;
export default DefaultSlotWithProps;
