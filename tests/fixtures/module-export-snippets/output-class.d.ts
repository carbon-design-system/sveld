import { SvelteComponentTyped, type Snippet } from "svelte";

export declare const badge: Snippet<[status: Status, label?: string]>;

export declare const empty: Snippet;

export declare function action<T extends () => void>(handler: T): ReturnType<Snippet>;

/**
 * One row for any item with an id.
 */
export declare function itemRow<T extends Identified>(item: T, index?: number): ReturnType<Snippet>;

type Identified = { id: string };

export type Status = "on" | "off";

type $Props = { status: Status };

export type ModuleExportSnippetsProps = $Props;

export default class ModuleExportSnippets extends SvelteComponentTyped<
  ModuleExportSnippetsProps,
  Record<string, any>,
  Record<string, never>
> {}
