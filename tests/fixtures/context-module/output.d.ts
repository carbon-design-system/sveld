import type { SvelteComponentTyped } from "svelte";

export type bool = string;

export type a = { b: 4 };

/**
 * Description for e
 */
export type e = { [key: string]: any };

/**
 * Log something
 */
export declare function log(message: string): void;

export declare function b(): {};

export declare function b2(): () => {};

export declare function b3(): () => false;

export interface ContextModuleProps {}

export default class ContextModule extends SvelteComponentTyped<ContextModuleProps, Record<string, any>, {}> {
  a: string;
}
