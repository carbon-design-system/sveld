import { SvelteComponentTyped } from "svelte";

export declare function merge(arg0: { a: string }, arg1: { b: number }): string;

export type TypedExportFunctionDestructuredParamsProps = Record<string, never>;

export default class TypedExportFunctionDestructuredParams extends SvelteComponentTyped<
  TypedExportFunctionDestructuredParamsProps,
  Record<string, any>,
  Record<string, never>
> {
  move: (arg0: [number, number], arg1: { animate: boolean }) => any;

  focus: (arg: { preventScroll: boolean }) => any;
}
