import type { Component } from "svelte";

export declare function merge(arg0: { a: string }, arg1: { b: number }): string;

export type TypedExportFunctionDestructuredParamsProps = Record<string, never>;

export type TypedExportFunctionDestructuredParamsExports = {
  move: (arg0: [number, number], arg1: { animate: boolean }) => any;

  focus: (arg: { preventScroll: boolean }) => any;
};

declare const TypedExportFunctionDestructuredParams: Component<
  TypedExportFunctionDestructuredParamsProps,
  TypedExportFunctionDestructuredParamsExports,
  ""
>;
export default TypedExportFunctionDestructuredParams;
