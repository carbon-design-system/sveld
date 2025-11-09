import type { SvelteComponentTyped } from "svelte";

export type ModuleReexportDirectProps = {
  /**
   * Configuration settings
   * @default { enabled: true }
   */
  config?: { enabled: true };

  /**
   * Optional callback function
   * @default undefined
   */
  onReady: undefined;
};

export default class ModuleReexportDirect extends SvelteComponentTyped<
  ModuleReexportDirectProps,
  Record<string, any>,
  { header: Record<string, never>; default: Record<string, never> }
> {}
