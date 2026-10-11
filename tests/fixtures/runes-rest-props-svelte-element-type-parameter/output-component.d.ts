import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Tag extends keyof HTMLElementTagNameMap = 'div'> = NoInfer<SvelteHTMLElements[Tag]>;

type $Props<Tag extends keyof HTMLElementTagNameMap = 'div'> = ({
    tag?: Tag;
    [key: string]: unknown
  }) & {
  [key: `data-${string}`]: unknown;
};

export type RunesRestPropsSvelteElementTypeParameterProps<Tag extends keyof HTMLElementTagNameMap = 'div'> = (Tag extends any ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : never) & $Props<Tag>;

export type RunesRestPropsSvelteElementTypeParameterExports = Record<string, never>;

interface RunesRestPropsSvelteElementTypeParameterComponent {
  new <Tag extends keyof HTMLElementTagNameMap = 'div'>(
    options: ComponentConstructorOptions<RunesRestPropsSvelteElementTypeParameterProps<Tag>>
  ): SvelteComponent<RunesRestPropsSvelteElementTypeParameterProps<Tag>> & RunesRestPropsSvelteElementTypeParameterExports;
  <Tag extends keyof HTMLElementTagNameMap = 'div'>(
    this: void,
    internals: ComponentInternals,
    props: RunesRestPropsSvelteElementTypeParameterProps<Tag>
  ): {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<RunesRestPropsSvelteElementTypeParameterProps<Tag>>): void;
  } & RunesRestPropsSvelteElementTypeParameterExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const RunesRestPropsSvelteElementTypeParameter: RunesRestPropsSvelteElementTypeParameterComponent;
export default RunesRestPropsSvelteElementTypeParameter;
