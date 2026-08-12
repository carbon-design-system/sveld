import { SvelteComponentTyped } from "svelte";

export type CallExpressionDefaultHoistedFunctionProps = {
  /**
   * @default uniqueId()
   */
  id?: string;
};

export default class CallExpressionDefaultHoistedFunction extends SvelteComponentTyped<
  CallExpressionDefaultHoistedFunctionProps,
  Record<string, any>,
  Record<string, never>
> {}
