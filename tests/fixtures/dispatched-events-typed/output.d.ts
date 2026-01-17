import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedProps = {
  children?: (this: void) => void;
};

export default class DispatchedEventsTyped extends SvelteComponentTyped<
  DispatchedEventsTypedProps,
  {
    /** Fired on mouseover. */
    hover: CustomEvent<{ h1: boolean }>;
    destroy: CustomEvent<null>;
  },
  { default: Record<string, never> }
> {}
