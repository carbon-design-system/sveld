import { SvelteComponentTyped } from "svelte";

export type RunesDispatchedEventsProps = {
  value: any;

  onchange: any;
};

export default class RunesDispatchedEvents extends SvelteComponentTyped<
  RunesDispatchedEventsProps,
  Record<string, any>,
  Record<string, never>
> {}
