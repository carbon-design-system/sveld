/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps extends svelte.JSX.SVGAttributes<SVGSVGElement> {
  [key: `data-${string}`]: any;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
