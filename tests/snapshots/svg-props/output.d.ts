/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps extends svelte.JSX.SVGAttributes<SVGSVGElement> {}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
