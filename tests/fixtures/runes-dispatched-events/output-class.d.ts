import { SvelteComponentTyped } from "svelte";

export type RunesDispatchedEventsProps = {
  /**
   * @default undefined
   */
  value: undefined;

  /**
   * @default undefined
   */
  onchange: undefined;
};

export default class RunesDispatchedEvents extends SvelteComponentTyped<
  RunesDispatchedEventsProps,
  Record<string, any>,
  Record<string, never>
> {}
