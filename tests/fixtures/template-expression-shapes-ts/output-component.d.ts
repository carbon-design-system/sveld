import type { Component } from "svelte";

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

export type TemplateExpressionShapesTsExports = Record<string, never>;

declare const TemplateExpressionShapesTs: Component<
  TemplateExpressionShapesTsProps,
  TemplateExpressionShapesTsExports,
  ""
>;
export default TemplateExpressionShapesTs;
