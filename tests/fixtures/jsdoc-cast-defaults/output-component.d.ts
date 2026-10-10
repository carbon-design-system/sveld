import type { Component } from "svelte";

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

export type JsdocCastDefaultsExports = Record<string, never>;

declare const JsdocCastDefaults: Component<
  JsdocCastDefaultsProps,
  JsdocCastDefaultsExports,
  ""
>;
export default JsdocCastDefaults;
