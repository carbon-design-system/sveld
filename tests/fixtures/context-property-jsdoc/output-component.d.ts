import type { Component } from "svelte";

export type PanelsContext = {
  /** Number of open panels */
  count: number;
  /** Hidden from docs */
  secret: number;
  items: number[];
  /** Adds an item to the group. */
  register: (id: string) => void;
};

/**
 * Current label
 */
export type LabelContext = string;

export type ContextPropertyJsdocProps = Record<string, never>;

export type ContextPropertyJsdocExports = Record<string, never>;

declare const ContextPropertyJsdoc: Component<
  ContextPropertyJsdocProps,
  ContextPropertyJsdocExports,
  ""
>;
export default ContextPropertyJsdoc;
