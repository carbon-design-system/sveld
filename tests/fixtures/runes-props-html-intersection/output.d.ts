import { SvelteComponentTyped } from "svelte";
import type { HTMLButtonAttributes, SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = ({ variant?: "primary" | "secondary" } & HTMLButtonAttributes) & {
  [key: `data-${string}`]: unknown;
};

export type RunesPropsHtmlIntersectionProps = Omit<$RestProps, keyof $Props> & $Props;

export default class RunesPropsHtmlIntersection extends SvelteComponentTyped<
  RunesPropsHtmlIntersectionProps,
  Record<string, any>,
  Record<string, never>
> {}
