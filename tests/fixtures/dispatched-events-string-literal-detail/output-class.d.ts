import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsStringLiteralDetailProps = Record<string, never>;

export default class DispatchedEventsStringLiteralDetail extends SvelteComponentTyped<
  DispatchedEventsStringLiteralDetailProps,
  { status: CustomEvent<"done"> },
  Record<string, never>
> {}
