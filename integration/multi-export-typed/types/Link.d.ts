/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface LinkProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {}

export default class Link extends SvelteComponent<LinkProps, { click: WindowEventMap["click"] }, { default: {} }> {}
