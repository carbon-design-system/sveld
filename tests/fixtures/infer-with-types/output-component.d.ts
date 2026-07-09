import type { Component } from "svelte";

export type InferWithTypesProps = {
  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  /**
   * @default undefined
   */
  name: string;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;

  children?: (this: void) => void;
};

export type InferWithTypesExports = {
  propConst: { [key: string]: boolean };

  fn: () => any;
};

declare const InferWithTypes: Component<
  InferWithTypesProps,
  InferWithTypesExports,
  ""
>;
export default InferWithTypes;
