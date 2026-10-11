import { SvelteComponentTyped } from "svelte";

declare enum Size {
  Small = "sm",
  Large = "lg",
}

type Density = "compact" | "comfortable";

export type TsLocalEnumPropProps = {
  /**
   * @default Size.Small
   */
  size?: Size;

  /**
   * @default Density.Compact
   */
  density?: Density;

  children?: (this: void) => void;
};

export default class TsLocalEnumProp extends SvelteComponentTyped<
  TsLocalEnumPropProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
