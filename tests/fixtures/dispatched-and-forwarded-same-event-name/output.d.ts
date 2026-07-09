import { SvelteComponentTyped } from "svelte";

export type DispatchedAndForwardedSameEventNameProps = Record<string, never>;

export default class DispatchedAndForwardedSameEventName extends SvelteComponentTyped<
  DispatchedAndForwardedSameEventNameProps,
  { click: CustomEvent<any> },
  Record<string, never>
> {}
