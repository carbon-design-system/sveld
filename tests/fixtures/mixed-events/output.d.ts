import { SvelteComponentTyped } from "svelte";

export type MixedEventsProps = Record<string, never>;

export default class MixedEvents extends SvelteComponentTyped<
  MixedEventsProps,
  { blur: FocusEvent | CustomEvent<FocusEvent>; "custom-focus": CustomEvent<FocusEvent | number> },
  Record<string, never>
> {}
