import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["p"];

type $Props = ({
    rows: {
      id: string;
      label?: string
    }[];
  }) & {
  [key: `data-${string}`]: unknown;
};

export type RunesEachConstOptionalTypeAnnotationProps = Omit<$RestProps, keyof $Props> & $Props;

export type RunesEachConstOptionalTypeAnnotationExports = Record<string, never>;

declare const RunesEachConstOptionalTypeAnnotation: Component<
  RunesEachConstOptionalTypeAnnotationProps,
  RunesEachConstOptionalTypeAnnotationExports,
  ""
>;
export default RunesEachConstOptionalTypeAnnotation;
