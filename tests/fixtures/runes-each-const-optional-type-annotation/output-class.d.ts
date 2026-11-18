import { SvelteComponentTyped } from "svelte";
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

export default class RunesEachConstOptionalTypeAnnotation extends SvelteComponentTyped<
  RunesEachConstOptionalTypeAnnotationProps,
  Record<string, any>,
  Record<string, never>
> {}
