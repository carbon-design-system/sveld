import { SvelteComponentTyped } from "svelte";

export type CemAccessorMethodsProps = Record<string, never>;

export default class CemAccessorMethods extends SvelteComponentTyped<
  CemAccessorMethodsProps,
  Record<string, any>,
  Record<string, never>
> {
  version: string;

  setLabel: (label: string) => string;

  getCount: () => number;
}
