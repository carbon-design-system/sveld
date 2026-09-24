import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsEscapedUnfollowableProps = Record<string, never>;

export default class DispatchedEventsEscapedUnfollowable extends SvelteComponentTyped<
  DispatchedEventsEscapedUnfollowableProps,
  {
    /** Fired by `registry.track`. */
    open: CustomEvent<null>;
  },
  Record<string, never>
> {}
