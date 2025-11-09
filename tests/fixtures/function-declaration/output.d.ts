import type { SvelteComponentTyped } from "svelte";

export type FunctionDeclarationProps = {
  /**
   * @default () => {}
   */
  fnA?: (...args: any[]) => any;
};

export default class FunctionDeclaration extends SvelteComponentTyped<
  FunctionDeclarationProps,
  Record<string, any>,
  Record<string, never>
> {
  fnB: (...args: any[]) => any;

  add: () => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
