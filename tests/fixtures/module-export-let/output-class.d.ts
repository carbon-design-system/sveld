import { SvelteComponentTyped } from "svelte";

/**
 * Instances created so far
 */
export declare let count: number;

export declare let legacy: string;

export type ModuleExportLetProps = Record<string, never>;

export default class ModuleExportLet extends SvelteComponentTyped<
  ModuleExportLetProps,
  Record<string, any>,
  Record<string, never>
> {}
