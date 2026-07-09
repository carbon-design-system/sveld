import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsProps = {
  children?: (this: void) => void;
};

export default class DispatchedEvents extends SvelteComponentTyped<
  DispatchedEventsProps,
  {
    destroy: CustomEvent<null>;
    "destroy--component": CustomEvent<null>;
    "destroy:component": CustomEvent<null>;
    hover: CustomEvent<any>;
  },
  { default: Record<string, never> }
> {}
