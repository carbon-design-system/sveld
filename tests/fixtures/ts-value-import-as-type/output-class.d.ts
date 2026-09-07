import { SvelteComponentTyped } from "svelte";
import type { Size } from "./types";

export type TsValueImportAsTypeProps = {
  size: Size;

  children?: (this: void) => void;
};

export default class TsValueImportAsType extends SvelteComponentTyped<
  TsValueImportAsTypeProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
