import type { Component } from "svelte";

export type EventsStableOrderProps = {
  onalpha?: (event: CustomEvent<null>) => void;

  onblur?: (event: WindowEventMap["blur"]) => void;

  onclick?: (event: WindowEventMap["click"]) => void;

  onzeta?: (event: CustomEvent<null>) => void;
};

export type EventsStableOrderExports = Record<string, never>;

declare const EventsStableOrder: Component<
  EventsStableOrderProps,
  EventsStableOrderExports,
  ""
>;
export default EventsStableOrder;
