import type { SvelteComponentTyped } from "svelte";

export interface FunctionDeclarationProps {
  /**
   * @default () => {}
   */
  fnA?: () => {};
}

export default class FunctionDeclaration extends SvelteComponentTyped<
  FunctionDeclarationProps,
  Record<string, any>,
  {}
> {
  fnB: () => {};

  add: () => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
