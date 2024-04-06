import type { SvelteComponentTyped } from "svelte";

export interface DispatchedEventsProps {}

export default class DispatchedEvents extends SvelteComponentTyped<
  DispatchedEventsProps,
  {
    hover: CustomEvent<any>;
    destroy: CustomEvent<null>;
    ["destroy--component"]: CustomEvent<null>;
    ["destroy:component"]: CustomEvent<null>;
  },
  { default: {} }
> {}
