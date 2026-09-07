import type { Component } from "svelte";

export type InferBasicProps = {
  /**
   * @default null
   */
  ref?: any;

  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  name: any;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;

  children?: (this: void) => void;
};

export type InferBasicExports = {
  propConst: { 1: true };

  fn: () => any;
};

declare const InferBasic: Component<
  InferBasicProps,
  InferBasicExports,
  ""
>;
export default InferBasic;
