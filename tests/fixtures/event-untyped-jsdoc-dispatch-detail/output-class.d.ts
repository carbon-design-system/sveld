import { SvelteComponentTyped } from "svelte";

export type EventUntypedJsdocDispatchDetailProps = Record<string, never>;

export default class EventUntypedJsdocDispatchDetail extends SvelteComponentTyped<
  EventUntypedJsdocDispatchDetailProps,
  {
    /** Fired on close. */
    close: CustomEvent<{ reason: string }>;
    /** Fired on open. */
    open: CustomEvent<null>;
    /** Fired on reset. */
    reset: CustomEvent<null>;
    /** Fired on toggle. */
    toggle: CustomEvent<null>;
  },
  Record<string, never>
> {}
