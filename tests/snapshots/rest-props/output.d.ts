/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["h1"]> {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
