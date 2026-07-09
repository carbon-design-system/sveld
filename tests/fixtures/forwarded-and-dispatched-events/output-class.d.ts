import { SvelteComponentTyped } from "svelte";

export type ForwardedAndDispatchedEventsProps = Record<string, never>;

export default class ForwardedAndDispatchedEvents extends SvelteComponentTyped<
  ForwardedAndDispatchedEventsProps,
  { change: CustomEvent<any> },
  Record<string, never>
> {}
