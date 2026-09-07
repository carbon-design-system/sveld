import type { Component } from "svelte";

declare enum Size {
  Small = "sm",
  Large = "lg",
}

export type TsLocalEnumPropProps = {
  /**
   * @default Size.Small
   */
  size?: Size;

  children?: (this: void) => void;
};

export type TsLocalEnumPropExports = Record<string, never>;

declare const TsLocalEnumProp: Component<
  TsLocalEnumPropProps,
  TsLocalEnumPropExports,
  ""
>;
export default TsLocalEnumProp;
