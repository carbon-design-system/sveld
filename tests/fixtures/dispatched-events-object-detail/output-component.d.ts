import type { Component } from "svelte";

export type DispatchedEventsObjectDetailProps = {
  id: string;

  onitems?: (event: CustomEvent<number[]>) => void;

  onsave?: (event: CustomEvent<{ id: string }>) => void;
};

export type DispatchedEventsObjectDetailExports = Record<string, never>;

declare const DispatchedEventsObjectDetail: Component<
  DispatchedEventsObjectDetailProps,
  DispatchedEventsObjectDetailExports,
  ""
>;
export default DispatchedEventsObjectDetail;
