import { SvelteComponentTyped } from "svelte";

export type InstanceExportConstFunctionJsdocProps = {
  /**
   * @default 1
   */
  size?: number;
};

export default class InstanceExportConstFunctionJsdoc extends SvelteComponentTyped<
  InstanceExportConstFunctionJsdocProps,
  Record<string, any>,
  Record<string, never>
> {
  /**
   * Formats a value.
   */
  format: (value: string) => string;

  identity: <T>(value: T) => T;
}
