import type { Component } from "svelte";

export type MixedEventTypesProps = {
  onchange?: (event: WindowEventMap["change"]) => void;

  /** Custom event from component (component forwarded event) */
  oncustomEvent?: (event: CustomEvent<number>) => void;

  /** Input value changed (native forwarded event) */
  oninput?: (event: CustomEvent<string>) => void;

  onsubmit?: (event: CustomEvent<any>) => void;
};

export type MixedEventTypesExports = Record<string, never>;

declare const MixedEventTypes: Component<
  MixedEventTypesProps,
  MixedEventTypesExports,
  ""
>;
export default MixedEventTypes;
