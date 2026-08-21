import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "sm"
   */
  size?: string;

  /**
   * @default false
   */
  disabled?: boolean;

  /**
   * @default []
   */
  items?: [];

  /**
   * @default []
   */
  refs?: [];

  /**
   * @default undefined
   */
  label?: undefined;

  [key: `data-${string}`]: unknown;
};

export type TemplateExpressionShapesProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TemplateExpressionShapes extends SvelteComponentTyped<
  TemplateExpressionShapesProps,
  Record<string, any>,
  Record<string, never>
> {}
