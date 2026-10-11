import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Tag extends keyof HTMLElementTagNameMap = 'div'> = NoInfer<SvelteHTMLElements[Tag]>;

type $Props<Tag extends keyof HTMLElementTagNameMap = 'div'> = ({
    tag?: Tag;
    [key: string]: unknown
  }) & {
  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsSvelteElementTypeParameterProps<Tag extends keyof HTMLElementTagNameMap = 'div'> = (Tag extends any ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : never) & $Props<Tag>;

export default class RunesRestPropsSvelteElementTypeParameter<Tag extends keyof HTMLElementTagNameMap = 'div'> extends SvelteComponentTyped<
  RunesRestPropsSvelteElementTypeParameterProps<Tag>,
  Record<string, any>,
  Record<string, never>
> {}
