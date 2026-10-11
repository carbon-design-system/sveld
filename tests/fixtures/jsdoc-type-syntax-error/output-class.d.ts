import { SvelteComponentTyped } from "svelte";

export type JsdocTypeSyntaxErrorProps = {
  /**
   * @default []
   */
  closure?: any;

  /**
   * @default ""
   */
  truncated?: any;
};

export default class JsdocTypeSyntaxError extends SvelteComponentTyped<
  JsdocTypeSyntaxErrorProps,
  Record<string, any>,
  Record<string, never>
> {}
