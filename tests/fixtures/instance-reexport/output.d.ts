import { SvelteComponentTyped } from "svelte";

export type InstanceReexportProps = {
  /**
   * Array of data items
   * @default []
   */
  data?: [];

  /**
   * Whether to show details
   * @default false
   */
  showDetails?: boolean;
};

export default class InstanceReexport extends SvelteComponentTyped<
  InstanceReexportProps,
  Record<string, any>,
  Record<string, never>
> {}
