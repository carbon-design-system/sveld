import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsObjectDetailUnknownKeysProps = Record<string, never>;

export default class DispatchedEventsObjectDetailUnknownKeys extends SvelteComponentTyped<
  DispatchedEventsObjectDetailUnknownKeysProps,
  {
    computed: CustomEvent<Record<string, any>>;
    empty: CustomEvent<Record<string, never>>;
    mixed: CustomEvent<{
        id: number;
        [key: string]: any;
      }>;
    spread: CustomEvent<Record<string, any>>;
  },
  Record<string, never>
> {}
