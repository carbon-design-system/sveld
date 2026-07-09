import type { Component } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export type MyTypedefArray = MyTypedef[];

export type TypedefsProps = {
  /**
   * @default { 1: true }
   */
  prop1?: MyTypedef;

  /**
   * @default []
   */
  prop2?: MyTypedefArray;

  children?: (this: void, ...args: [{
        prop1: MyTypedef;
        prop2: MyTypedefArray;
      }]) => void;
};

export type TypedefsExports = Record<string, never>;

declare const Typedefs: Component<
  TypedefsProps,
  TypedefsExports,
  ""
>;
export default Typedefs;
