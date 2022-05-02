/// <reference types="svelte" />
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

export interface InputProps {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  a: string;
}
