import { SvelteComponentTyped } from "svelte";

export type GroupContext = {
  size: string;
  label: string;
  id: string;
  inherited: any;
};

export type ContextExpressionValuesProps = {
  /**
   * @default false
   */
  dense?: boolean;

  children?: (this: void) => void;
};

export default class ContextExpressionValues extends SvelteComponentTyped<
  ContextExpressionValuesProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
