import { SvelteComponentTyped } from "svelte";

export declare function format(): any;

export type ExportSpecifierBindingsProps = {
  /**
   * @default 1
   */
  size?: number;

  x?: any;

  why?: any;

  a?: any;

  b?: any;
};

export default class ExportSpecifierBindings extends SvelteComponentTyped<
  ExportSpecifierBindingsProps,
  Record<string, any>,
  Record<string, never>
> {
  reset: () => any;
}
