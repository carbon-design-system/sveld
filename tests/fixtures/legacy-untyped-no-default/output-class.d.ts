import { SvelteComponentTyped } from "svelte";

export type LegacyUntypedNoDefaultProps = {
  a: any;

  b: string;

  /**
   * @default 1
   */
  c?: number;
};

export default class LegacyUntypedNoDefault extends SvelteComponentTyped<
  LegacyUntypedNoDefaultProps,
  Record<string, any>,
  Record<string, never>
> {}
