import { SvelteComponentTyped } from "svelte";

export type CallExpressionDefaultUnresolvableImportProps = {
  /**
   * @default generateId()
   */
  id?: any;
};

export default class CallExpressionDefaultUnresolvableImport extends SvelteComponentTyped<
  CallExpressionDefaultUnresolvableImportProps,
  Record<string, any>,
  Record<string, never>
> {}
