/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponent<InputProps, { KEY: CustomEvent<{ key: string }> }, {}> {}
