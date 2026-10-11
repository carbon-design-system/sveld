import type { Component } from "svelte";

export type FunctionDeclarationProps = {
  /**
   * @default () => {}
   */
  fnA?: (...args: any[]) => any;
};

export type FunctionDeclarationExports = {
  fnB: (...args: any[]) => any;

  add: (a: any, b: any) => any;

  reset: () => any;

  format: (value: any, locale?: any, ...rest: any[]) => string;

  pick: (arg0: any) => any;

  double: (n: number) => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
};

declare const FunctionDeclaration: Component<
  FunctionDeclarationProps,
  FunctionDeclarationExports,
  ""
>;
export default FunctionDeclaration;
