import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsNullDetailProps = Record<string, never>;

export default class DispatchedEventsNullDetail extends SvelteComponentTyped<
  DispatchedEventsNullDetailProps,
  { clear: CustomEvent<null> },
  Record<string, never>
> {}
