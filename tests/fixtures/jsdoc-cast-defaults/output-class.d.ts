import { SvelteComponentTyped } from "svelte";

export interface Row {
  id: string;
  label?: string
}

export type JsdocCastDefaultsProps = {
  /**
   * @default []
   */
  rows?: Row[];

  /**
   * @default null
   */
  selected?: Row | null;

  /**
   * @default {}
   */
  anything?: any;
};

export default class JsdocCastDefaults extends SvelteComponentTyped<
  JsdocCastDefaultsProps,
  Record<string, any>,
  Record<string, never>
> {}
