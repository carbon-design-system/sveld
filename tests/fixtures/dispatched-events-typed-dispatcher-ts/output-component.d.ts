import type { Component } from "svelte";

export type DispatchedEventsTypedDispatcherTsProps = {
  oncancel?: (event: CustomEvent<null>) => void;

  onsave?: (event: CustomEvent<{ id: string }>) => void;
};

export type DispatchedEventsTypedDispatcherTsExports = Record<string, never>;

declare const DispatchedEventsTypedDispatcherTs: Component<
  DispatchedEventsTypedDispatcherTsProps,
  DispatchedEventsTypedDispatcherTsExports,
  ""
>;
export default DispatchedEventsTypedDispatcherTs;
