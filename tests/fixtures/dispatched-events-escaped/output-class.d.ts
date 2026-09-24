import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsEscapedProps = {
  /**
   * @default false
   */
  open?: boolean;
};

export default class DispatchedEventsEscaped extends SvelteComponentTyped<
  DispatchedEventsEscapedProps,
  { close: CustomEvent<null> },
  Record<string, never>
> {}
