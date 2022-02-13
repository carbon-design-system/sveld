/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export type a = { b: 4 };

/**
 * Description for e
 */
export type e = { b: 4 };

/**
 * Log something
 */
export type log = (message: string) => void;

export type b = () => {};

export interface InputProps {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  a: string;
}
