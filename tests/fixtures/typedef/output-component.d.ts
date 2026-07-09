import type { Component } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export type TypedefProps = {
  /**
   * @default "id-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @default { 1: true }
   */
  prop1?: MyTypedef;

  children?: (this: void, ...args: [{ prop1: MyTypedef }]) => void;
};

export type TypedefExports = Record<string, never>;

declare const Typedef: Component<
  TypedefProps,
  TypedefExports,
  ""
>;
export default Typedef;
