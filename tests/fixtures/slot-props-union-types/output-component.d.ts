import type { Component } from "svelte";

export type SlotPropsUnionTypesProps = {
  /**
   * @default []
   */
  items?: Array<{
      value: string | number;
      status: "pending" | "complete" | "error"
    }>;

  /** Header slot */
  header?: (this: void, ...args: [{ active: boolean }]) => void;

  children?: (this: void, ...args: [{
        item: string | number;
        status: "pending" | "complete" | "error";
        error: Error | null;
      }]) => void;
};

export type SlotPropsUnionTypesExports = Record<string, never>;

declare const SlotPropsUnionTypes: Component<
  SlotPropsUnionTypesProps,
  SlotPropsUnionTypesExports,
  ""
>;
export default SlotPropsUnionTypes;
