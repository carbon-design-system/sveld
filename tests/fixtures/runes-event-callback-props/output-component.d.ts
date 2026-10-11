import type { Component } from "svelte";

export type RunesEventCallbackPropsProps = {
  /**
   * Fired when a value is saved.
   */
  onsave: (detail: { id: string }) => void;

  onclose: () => void;
};

export type RunesEventCallbackPropsExports = Record<string, never>;

declare const RunesEventCallbackProps: Component<
  RunesEventCallbackPropsProps,
  RunesEventCallbackPropsExports,
  ""
>;
export default RunesEventCallbackProps;
