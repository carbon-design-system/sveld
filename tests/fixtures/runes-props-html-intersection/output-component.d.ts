import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";
import type { HTMLButtonAttributes } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = ({ variant?: "primary" | "secondary" } & HTMLButtonAttributes) & {
  [key: `data-${string}`]: unknown;
};

export type RunesPropsHtmlIntersectionProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesPropsHtmlIntersectionExports = Record<string, never>;

declare const RunesPropsHtmlIntersection: Component<
  RunesPropsHtmlIntersectionProps,
  RunesPropsHtmlIntersectionExports,
  ""
>;
export default RunesPropsHtmlIntersection;
