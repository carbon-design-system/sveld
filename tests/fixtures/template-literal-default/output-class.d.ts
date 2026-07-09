import { SvelteComponentTyped } from "svelte";

export type TemplateLiteralDefaultProps = {
  /**
   * Template literal with call expression
   * @default `ccs-${Math.random().toString(36)}`
   */
  id?: string;

  /**
   * Static template literals
   * @default `prefix-`
   */
  prefix?: string;

  /**
   * @default `-suffix`
   */
  suffix?: string;

  /**
   * Template literal with multiple expressions
   * @default `Hello, ${"world"}! Count: ${42}`
   */
  message?: string;
};

export default class TemplateLiteralDefault extends SvelteComponentTyped<
  TemplateLiteralDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
