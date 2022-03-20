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
export type log = (message: string) => void;

export type b = () => {};

export interface InputProps {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  a: string;
}
