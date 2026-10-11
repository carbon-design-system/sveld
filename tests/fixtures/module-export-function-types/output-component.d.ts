import type { Component } from "svelte";

export declare function withCallback(cb: () => void): string;

export declare function curried<T>(value: T): () => T;

export declare const handlers: { onClose: () => void };

export declare const maybeHandler: (() => void) | null;

export declare let reassignable: (value: string) => void;

export type ModuleExportFunctionTypesProps = Record<string, never>;

export type ModuleExportFunctionTypesExports = Record<string, never>;

declare const ModuleExportFunctionTypes: Component<
  ModuleExportFunctionTypesProps,
  ModuleExportFunctionTypesExports,
  ""
>;
export default ModuleExportFunctionTypes;
