import type { Component } from "svelte";

export type DispatchedEventsEscapedProps = {
  /**
   * @default false
   */
  open?: boolean;

  onclose?: (event: CustomEvent<null>) => void;
};

export type DispatchedEventsEscapedExports = Record<string, never>;

declare const DispatchedEventsEscaped: Component<
  DispatchedEventsEscapedProps,
  DispatchedEventsEscapedExports,
  ""
>;
export default DispatchedEventsEscaped;
