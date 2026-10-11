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
  fnB: () => void;

  add: (a: any, b: any) => any;

  reset: () => void;

  format: (value: any, locale?: any, ...rest: any[]) => string;

  pick: (arg: any) => any;

  double: (n: number) => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
