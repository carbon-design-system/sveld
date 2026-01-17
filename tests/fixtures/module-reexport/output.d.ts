import { SvelteComponentTyped } from "svelte";

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

  children?: (this: void) => void;
};

export default class ModuleReexport extends SvelteComponentTyped<
  ModuleReexportProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
