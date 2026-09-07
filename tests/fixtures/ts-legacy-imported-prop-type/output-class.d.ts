import { SvelteComponentTyped } from "svelte";
import type { Size } from "./types";

export type TsLegacyImportedPropTypeProps = {
  /**
   * @default "sm"
   */
  size?: Size;

  children?: (this: void) => void;
};

export default class TsLegacyImportedPropType extends SvelteComponentTyped<
  TsLegacyImportedPropTypeProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
