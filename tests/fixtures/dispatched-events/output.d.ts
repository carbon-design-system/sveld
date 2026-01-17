import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsProps = {
  children?: (this: void) => void;
};

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
