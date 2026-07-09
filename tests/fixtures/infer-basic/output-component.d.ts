import type { Component } from "svelte";

export type InferBasicProps = {
  /**
   * @default null
   */
  ref?: undefined;

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
  name: undefined;

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
