import { SvelteComponentTyped } from "svelte";

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

export default class TsLocalEnumProp extends SvelteComponentTyped<
  TsLocalEnumPropProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
