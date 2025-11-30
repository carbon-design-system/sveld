import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsProps = Record<string, never>;

export default class DispatchedEvents extends SvelteComponentTyped<
  DispatchedEventsProps,
  {
    hover: CustomEvent<any>;
    destroy: CustomEvent<null>;
    "destroy--component": CustomEvent<null>;
    "destroy:component": CustomEvent<null>;
  },
  { default: Record<string, never> }
> {}
