import { SvelteComponentTyped } from "svelte";

export declare function withCallback(cb: () => void): string;

export declare function curried<T>(value: T): () => T;

export declare const handlers: { onClose: () => void };

export declare const maybeHandler: (() => void) | null;

export declare let reassignable: (value: string) => void;

export type ModuleExportFunctionTypesProps = Record<string, never>;

export default class ModuleExportFunctionTypes extends SvelteComponentTyped<
  ModuleExportFunctionTypesProps,
  Record<string, any>,
  Record<string, never>
> {}
