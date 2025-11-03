import type { SvelteComponentTyped } from "svelte";

export type MixedEventsProps = Record<string, never>;

export default class MixedEvents extends SvelteComponentTyped<
  MixedEventsProps,
  { "custom-focus": CustomEvent<FocusEvent | number>; blur: FocusEvent | CustomEvent<FocusEvent> },
  Record<string, never>
> {}
