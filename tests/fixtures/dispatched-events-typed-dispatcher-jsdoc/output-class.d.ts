import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedDispatcherJsdocProps = Record<string, never>;

export default class DispatchedEventsTypedDispatcherJsdoc extends SvelteComponentTyped<
  DispatchedEventsTypedDispatcherJsdocProps,
  {
    cancel: CustomEvent<null>;
    save: CustomEvent<{ id: string }>;
  },
  Record<string, never>
> {}
