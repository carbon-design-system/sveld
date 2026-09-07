import type { Component } from "svelte";
import type { Size } from "./types";

export type TsLegacyImportedPropTypeProps = {
  /**
   * @default "sm"
   */
  size?: Size;

  children?: (this: void) => void;
};

export type TsLegacyImportedPropTypeExports = Record<string, never>;

declare const TsLegacyImportedPropType: Component<
  TsLegacyImportedPropTypeProps,
  TsLegacyImportedPropTypeExports,
  ""
>;
export default TsLegacyImportedPropType;
