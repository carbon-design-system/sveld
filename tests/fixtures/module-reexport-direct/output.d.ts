import { SvelteComponentTyped } from "svelte";

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

  header?: (this: void) => void;

  children?: (this: void) => void;
};

export default class ModuleReexportDirect extends SvelteComponentTyped<
  ModuleReexportDirectProps,
  Record<string, any>,
  { default: Record<string, never>; header: Record<string, never> }
> {}
