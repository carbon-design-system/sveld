import type { Component } from "svelte";

export declare const bool: string;

export declare const a: { b: 4 };

/**
 * Description for e
 */
export declare const e: { [key: string]: any };

/**
 * Log something
 */
export declare function log(message: string): void;

export declare function b(): void;

export declare function b2(): any;

export declare function b3(): () => false;

export type ModuleScriptExportsProps = Record<string, never>;

export type ModuleScriptExportsExports = {
  a: string;
};

declare const ModuleScriptExports: Component<
  ModuleScriptExportsProps,
  ModuleScriptExportsExports,
  ""
>;
export default ModuleScriptExports;
