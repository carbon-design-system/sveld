import { SvelteComponentTyped } from "svelte";

export type DispatchedAndForwardedSameEventNameHostDispatchProps = Record<string, never>;

export default class DispatchedAndForwardedSameEventNameHostDispatch extends SvelteComponentTyped<
  DispatchedAndForwardedSameEventNameHostDispatchProps,
  { click: CustomEvent<1> },
  Record<string, never>
> {}
