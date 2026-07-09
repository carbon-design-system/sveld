import type { Component } from "svelte";

export type MixedEventsProps = {
  onblur?: (event: FocusEvent | CustomEvent<FocusEvent>) => void;

  "oncustom-focus"?: (event: CustomEvent<FocusEvent | number>) => void;
};

export type MixedEventsExports = Record<string, never>;

declare const MixedEvents: Component<
  MixedEventsProps,
  MixedEventsExports,
  ""
>;
export default MixedEvents;
