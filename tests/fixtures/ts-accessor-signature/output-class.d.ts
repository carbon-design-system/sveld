import { SvelteComponentTyped } from "svelte";

export type TsAccessorSignatureProps = {
  children?: (this: void) => void;
};

export default class TsAccessorSignature extends SvelteComponentTyped<
  TsAccessorSignatureProps,
  Record<string, any>,
  { default: Record<string, never> }
> {
  process: (input: string) => number;

  log: (message: string, level: any) => void;

  sum: (...values: number[]) => number;
}
