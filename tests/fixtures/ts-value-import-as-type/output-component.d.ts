import type { Component } from "svelte";
import type { Size } from "./types";

export type TsValueImportAsTypeProps = {
  size: Size;

  children?: (this: void) => void;
};

export type TsValueImportAsTypeExports = Record<string, never>;

declare const TsValueImportAsType: Component<
  TsValueImportAsTypeProps,
  TsValueImportAsTypeExports,
  ""
>;
export default TsValueImportAsType;
