import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocQuotedProps = Record<string, never>;

export default class DispatchedEventsTypedDispatcherJsdocQuoted extends SvelteComponentTyped<
  DispatchedEventsTypedDispatcherJsdocQuotedProps,
  {
    "a;b": CustomEvent<number>;
    "change:value": CustomEvent<string>;
    plain: CustomEvent<null>;
  },
  Record<string, never>
> {}
