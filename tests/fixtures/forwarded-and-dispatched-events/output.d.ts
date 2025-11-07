import type { SvelteComponentTyped } from "svelte";

export type ForwardedAndDispatchedEventsProps = Record<string, never>;

export default class ForwardedAndDispatchedEvents extends SvelteComponentTyped<
  ForwardedAndDispatchedEventsProps,
  { change: WindowEventMap["change"] },
  Record<string, never>
> {}
