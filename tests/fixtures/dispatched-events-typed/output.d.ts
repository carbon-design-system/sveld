import type { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedProps = Record<string, never>;

export default class DispatchedEventsTyped extends SvelteComponentTyped<
  DispatchedEventsTypedProps,
  {
    /** Fired on mouseover. */ hover: CustomEvent<{ h1: boolean }>;
    destroy: CustomEvent<null>;
  },
  { default: Record<string, never> }
> {}
