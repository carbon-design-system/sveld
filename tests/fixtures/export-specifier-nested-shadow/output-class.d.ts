import { SvelteComponentTyped } from "svelte";

export declare function helper(): any;

export declare const value: number;

export type ExportSpecifierNestedShadowProps = {
  /**
   * @default true
   */
  label?: boolean;

  /**
   * @default 1
   */
  size?: number;
};

export default class ExportSpecifierNestedShadow extends SvelteComponentTyped<
  ExportSpecifierNestedShadowProps,
  Record<string, any>,
  Record<string, never>
> {}
