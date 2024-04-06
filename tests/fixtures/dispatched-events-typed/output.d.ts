import type { SvelteComponentTyped } from "svelte";

export interface DispatchedEventsTypedProps {}

export default class DispatchedEventsTyped extends SvelteComponentTyped<
  DispatchedEventsTypedProps,
  {
    /** Fired on mouseover. */ hover: CustomEvent<{ h1: boolean }>;
    destroy: CustomEvent<null>;
  },
  { default: {} }
> {}
