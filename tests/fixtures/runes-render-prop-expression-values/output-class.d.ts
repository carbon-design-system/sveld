import { SvelteComponentTyped } from "svelte";

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

export default class RunesRenderPropExpressionValues extends SvelteComponentTyped<
  RunesRenderPropExpressionValuesProps,
  Record<string, any>,
  {
    default: {
      heading: string;
      count: number;
      kind: "primary";
      size: 2;
    };
  }
> {}
