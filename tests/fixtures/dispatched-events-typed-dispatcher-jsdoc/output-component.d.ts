import type { Component } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocProps = {
  oncancel?: (event: CustomEvent<null>) => void;

  onsave?: (event: CustomEvent<{ id: string }>) => void;
};

export type DispatchedEventsTypedDispatcherJsdocExports = Record<string, never>;

declare const DispatchedEventsTypedDispatcherJsdoc: Component<
  DispatchedEventsTypedDispatcherJsdocProps,
  DispatchedEventsTypedDispatcherJsdocExports,
  ""
>;
export default DispatchedEventsTypedDispatcherJsdoc;
