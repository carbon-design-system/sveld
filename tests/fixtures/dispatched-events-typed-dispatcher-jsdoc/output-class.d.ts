import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocProps = Record<string, never>;

export default class DispatchedEventsTypedDispatcherJsdoc extends SvelteComponentTyped<
  DispatchedEventsTypedDispatcherJsdocProps,
  {
    "a;b": CustomEvent<number>;
    cancel: CustomEvent<null>;
    "change:value": CustomEvent<string>;
    save: CustomEvent<{ id: string }>;
  },
  Record<string, never>
> {}
