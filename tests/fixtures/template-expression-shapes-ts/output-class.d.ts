import { SvelteComponentTyped } from "svelte";

export type TemplateExpressionShapesTsProps = {
  /**
   * @default "sm"
   */
  size?: "sm" | "lg";

  label?: string | undefined;

  /**
   * @default []
   */
  items?: string[];
};

export default class TemplateExpressionShapesTs extends SvelteComponentTyped<
  TemplateExpressionShapesTsProps,
  Record<string, any>,
  Record<string, never>
> {}
