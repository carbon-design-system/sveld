import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTypedDispatcherTsProps = Record<string, never>;

export default class DispatchedEventsTypedDispatcherTs extends SvelteComponentTyped<
  DispatchedEventsTypedDispatcherTsProps,
  {
    cancel: CustomEvent<null>;
    save: CustomEvent<{ id: string }>;
  },
  Record<string, never>
> {}
