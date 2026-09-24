import type { Component } from "svelte";

export type DispatchedEventsNullDetailProps = {
  onclear?: (event: CustomEvent<null>) => void;
};

export type DispatchedEventsNullDetailExports = Record<string, never>;

declare const DispatchedEventsNullDetail: Component<
  DispatchedEventsNullDetailProps,
  DispatchedEventsNullDetailExports,
  ""
>;
export default DispatchedEventsNullDetail;
