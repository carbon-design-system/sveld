import type { SvelteComponentTyped } from "svelte";

export interface MixedEventsProps {}

export default class MixedEvents extends SvelteComponentTyped<
  MixedEventsProps,
  { ["custom-focus"]: CustomEvent<FocusEvent | number>; blur: FocusEvent | CustomEvent<FocusEvent> },
  {}
> {}
