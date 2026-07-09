import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedProps = {
  children?: (this: void) => void;
};

export default class DispatchedEventsTyped extends SvelteComponentTyped<
  DispatchedEventsTypedProps,
  {
    destroy: CustomEvent<null>;
    /** Fired on mouseover. */
    hover: CustomEvent<{ h1: boolean }>;
  },
  { default: Record<string, never> }
> {}
