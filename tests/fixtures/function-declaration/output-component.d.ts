import type { Component } from "svelte";

export type FunctionDeclarationProps = {
  fnA?: (...args: any[]) => any;
};

export type FunctionDeclarationExports = {
  fnB: (...args: any[]) => any;

  add: () => any;

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
