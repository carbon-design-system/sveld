import { SvelteComponentTyped } from "svelte";

export type RunesDispatchedEventsProps = {
  /**
   * @default undefined
   */
  value: undefined;
};

export default class RunesDispatchedEvents extends SvelteComponentTyped<
  RunesDispatchedEventsProps,
  { change: CustomEvent<any> },
  Record<string, never>
> {}
