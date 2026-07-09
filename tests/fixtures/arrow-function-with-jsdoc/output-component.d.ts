import type { Component } from "svelte";

export type ArrowFunctionWithJsdocProps = {
  transform?: (value: string, options?: { uppercase?: boolean }) => string;

  processItems?: (items: string[], callback: (item: string, index: number) => void) => Promise<void>;

  createRecord?: (id: string) => {
    id: string;
    created: Date
  };
};

export type ArrowFunctionWithJsdocExports = Record<string, never>;

declare const ArrowFunctionWithJsdoc: Component<
  ArrowFunctionWithJsdocProps,
  ArrowFunctionWithJsdocExports,
  ""
>;
export default ArrowFunctionWithJsdoc;
