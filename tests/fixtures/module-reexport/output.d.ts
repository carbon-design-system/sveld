import type { SvelteComponentTyped } from "svelte";

export type ModuleReexportProps = {
  /**
   * Chart data to display
   * @default null
   */
  data?: undefined;

  /**
   * Chart title
   * @default 'Chart'
   */
  title?: string;
};

export default class ModuleReexport extends SvelteComponentTyped<
  ModuleReexportProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
