import type { Component } from "svelte";

export type LegacyPanelProps = {
  /**
   * @default undefined
   */
  title: string;

  onclick?: (event: WindowEventMap["click"]) => void;

  onclose?: (event: CustomEvent<any>) => void;
};

export type LegacyPanelExports = Record<string, never>;

declare const LegacyPanel: Component<
  LegacyPanelProps,
  LegacyPanelExports,
  ""
>;
export default LegacyPanel;
