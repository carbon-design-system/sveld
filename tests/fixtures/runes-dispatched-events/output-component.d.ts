import type { Component } from "svelte";

export type RunesDispatchedEventsProps = {
  /**
   * @default undefined
   */
  value: undefined;

  /**
   * @default undefined
   */
  onchange: undefined;
};

export type RunesDispatchedEventsExports = Record<string, never>;

declare const RunesDispatchedEvents: Component<
  RunesDispatchedEventsProps,
  RunesDispatchedEventsExports,
  ""
>;
export default RunesDispatchedEvents;
