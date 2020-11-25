/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["h1"]> {}

export default class Input extends SvelteComponent<InputProps, {}, {}> {}
