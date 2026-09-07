import type { Component } from "svelte";

export type TsAccessorSignatureProps = {
  children?: (this: void) => void;
};

export type TsAccessorSignatureExports = {
  process: (input: string) => number;

  log: (message: string, level: any) => void;

  sum: (...values: number[]) => number;
};

declare const TsAccessorSignature: Component<
  TsAccessorSignatureProps,
  TsAccessorSignatureExports,
  ""
>;
export default TsAccessorSignature;
