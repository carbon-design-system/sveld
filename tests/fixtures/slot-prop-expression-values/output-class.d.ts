import { SvelteComponentTyped } from "svelte";

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

export default class SlotPropExpressionValues extends SvelteComponentTyped<
  SlotPropExpressionValuesProps,
  Record<string, any>,
  {
    default: {
      heading: string;
      count: number;
      kind: "primary";
      size: 2;
      static: "text";
    };
  }
> {}
