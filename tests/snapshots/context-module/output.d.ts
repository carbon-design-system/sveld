/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  a: string;
}
