import type { Component } from "svelte";

export type UserSettingsContext = {
  /** Select an item */
  select: (id: string) => void;
  /** Clear the selection */
  clear: () => void;
};

export type ContextUnderscoreProps = Record<string, never>;

export type ContextUnderscoreExports = Record<string, never>;

declare const ContextUnderscore: Component<
  ContextUnderscoreProps,
  ContextUnderscoreExports,
  ""
>;
export default ContextUnderscore;
