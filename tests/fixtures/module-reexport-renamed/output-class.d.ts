import { SvelteComponentTyped } from "svelte";

export type ModuleReexportRenamedProps = {
  /**
   * Controls visibility
   * @default true
   */
  visible?: boolean;

  /**
   * Configuration object
   * @default {}
   */
  config?: {};

  children?: (this: void) => void;
};

export default class ModuleReexportRenamed extends SvelteComponentTyped<
  ModuleReexportRenamedProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
