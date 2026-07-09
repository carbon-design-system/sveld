import type { Component } from "svelte";

export type DispatchedEventsStringLiteralDetailProps = {
  onstatus?: (event: CustomEvent<"done">) => void;
};

export type DispatchedEventsStringLiteralDetailExports = Record<string, never>;

declare const DispatchedEventsStringLiteralDetail: Component<
  DispatchedEventsStringLiteralDetailProps,
  DispatchedEventsStringLiteralDetailExports,
  ""
>;
export default DispatchedEventsStringLiteralDetail;
