import { SvelteComponentTyped } from "svelte";

export type CemCustomElementObjectConfigProps = {
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

export default class CemCustomElementObjectConfig extends SvelteComponentTyped<
  CemCustomElementObjectConfigProps,
  Record<string, any>,
  Record<string, never>
> {}
