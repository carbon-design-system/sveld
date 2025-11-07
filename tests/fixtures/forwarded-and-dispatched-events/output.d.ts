import type { SvelteComponentTyped } from "svelte";

export type ForwardedAndDispatchedEventsProps = {};

export default class ForwardedAndDispatchedEvents extends SvelteComponentTyped<
  ForwardedAndDispatchedEventsProps,
  { change: WindowEventMap["change"] },
  {}
> {}
