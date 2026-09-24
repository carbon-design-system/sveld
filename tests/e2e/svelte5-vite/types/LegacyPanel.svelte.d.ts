import type { Component } from "svelte";

export type LegacyPanelProps = {
  title: string;

  onclick?: (event: WindowEventMap["click"]) => void;

  onclose?: (event: CustomEvent<{ reason: string }>) => void;
};

export type LegacyPanelExports = Record<string, never>;

declare const LegacyPanel: Component<
  LegacyPanelProps,
  LegacyPanelExports,
  ""
>;
export default LegacyPanel;
