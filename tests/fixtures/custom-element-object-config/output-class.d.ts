import { SvelteComponentTyped } from "svelte";

export type CustomElementObjectConfigProps = {
  /**
   * @default "default"
   */
  variant?: string;

  /**
   * @default false
   */
  active?: boolean;

  /**
   * @default []
   */
  tags?: string[];
};

export default class CustomElementObjectConfig extends SvelteComponentTyped<
  CustomElementObjectConfigProps,
  Record<string, any>,
  Record<string, never>
> {}
