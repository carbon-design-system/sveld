import { SvelteComponentTyped } from "svelte";

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

  add: (a: any, b: any) => any;

  reset: () => any;

  format: (value: any, locale?: any, ...rest: any[]) => string;

  pick: (arg0: any) => any;

  double: (n: number) => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
