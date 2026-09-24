import type { Component } from "svelte";

export type EventUntypedJsdocDispatchDetailProps = {
  /** Fired on close. */
  onclose?: (event: CustomEvent<{ reason: string }>) => void;

  /** Fired on open. */
  onopen?: (event: CustomEvent<null>) => void;

  /** Fired on reset. */
  onreset?: (event: CustomEvent<null>) => void;

  /** Fired on toggle. */
  ontoggle?: (event: CustomEvent<null>) => void;
};

export type EventUntypedJsdocDispatchDetailExports = Record<string, never>;

declare const EventUntypedJsdocDispatchDetail: Component<
  EventUntypedJsdocDispatchDetailProps,
  EventUntypedJsdocDispatchDetailExports,
  ""
>;
export default EventUntypedJsdocDispatchDetail;
