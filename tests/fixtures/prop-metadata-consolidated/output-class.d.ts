import { SvelteComponentTyped } from "svelte";

export type PropMetadataConsolidatedProps = {
  typed: string;

  /**
   * JSDoc wins over default inference.
   * @default 1
   */
  documented?: number;

  /**
   * @default "md"
   */
  literalDefault?: string;

  /**
   * @default true
   */
  boolDefault?: boolean;

  /**
   * @default [1, "two", false]
   */
  arrayDefault?: (number | string | boolean)[];

  /**
   * @default { size: "md", count: 2 }
   */
  objectDefault?: {
    size: string;
    count: number
  };

  /**
   * @default (value: string) => value.toUpperCase()
   */
  callbackDefault?: (value: string) => any;

  /**
   * @default (count: number, unit?: string) => `${count}${unit ?? ""}`
   */
  formatDefault?: (count: number, unit?: string) => string;

  /**
   * @default makeDefault()
   */
  callDefault?: string;

  /**
   * @default Number.MAX_VALUE
   */
  memberDefault?: number;

  /**
   * @default count + 1
   */
  expressionDefault?: number;

  unknown: any;
};

export default class PropMetadataConsolidated extends SvelteComponentTyped<
  PropMetadataConsolidatedProps,
  Record<string, any>,
  Record<string, never>
> {}
