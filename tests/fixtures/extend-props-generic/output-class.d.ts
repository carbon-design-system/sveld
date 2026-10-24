import { SvelteComponentTyped } from "svelte";
import type { BaseProps } from "./Base.svelte";

type $Props<T = any> = {
  /**
   * Specify the curve.
   * @default "linear"
   */
  curve?: "linear" | "monotone";
};

export type ExtendPropsGenericProps<T = any> = Omit<BaseProps<T>, keyof $Props<T>> & $Props<T>;

export default class ExtendPropsGeneric<T = any> extends SvelteComponentTyped<
  ExtendPropsGenericProps<T>,
  Record<string, any>,
  Record<string, never>
> {}
