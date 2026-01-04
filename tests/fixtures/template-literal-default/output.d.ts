import { SvelteComponentTyped } from "svelte";

export type TemplateLiteralDefaultProps = {
  /**
   * Template literal with call expression
   * @default `ccs-${Math.random().toString(36)}`
   */
  id?: `ccs-${string}` & {};

  /**
   * Static template literals
   * @default `prefix-`
   */
  prefix?: `prefix-` & {};

  /**
   * @default `-suffix`
   */
  suffix?: `-suffix` & {};

  /**
   * Template literal with multiple expressions
   * @default `Hello, ${"world"}! Count: ${42}`
   */
  message?: `Hello, ${"world"}! Count: ${42}` & {};
};

export default class TemplateLiteralDefault extends SvelteComponentTyped<
  TemplateLiteralDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
