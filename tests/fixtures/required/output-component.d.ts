import type { Component } from "svelte";

export type RequiredProps = {
  /**
   * @required
   * @default true
   */
  prop?: boolean;

  /**
   * This is a comment.
   * @required
   * @default true
   */
  prop1?: boolean | string;

  /**
   * @default undefined
   */
  prop2: undefined;

  /**
   * @default undefined
   */
  prop3: boolean;

  children?: (this: void, ...args: [{
        prop: boolean;
        prop1: boolean | string;
        prop2: any;
        prop3: boolean;
      }]) => void;
};

export type RequiredExports = Record<string, never>;

declare const Required: Component<
  RequiredProps,
  RequiredExports,
  ""
>;
export default Required;
