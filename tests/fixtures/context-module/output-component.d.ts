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

export declare function b(...args: any[]): any;

export declare function b2(...args: any[]): any;

export declare function b3(): () => false;

export type ContextModuleProps = Record<string, never>;

export type ContextModuleExports = {
  a: string;
};

declare const ContextModule: Component<
  ContextModuleProps,
  ContextModuleExports,
  ""
>;
export default ContextModule;
