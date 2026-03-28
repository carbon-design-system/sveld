import { SvelteComponentTyped } from "svelte";

export type EventsStableOrderProps = Record<string, never>;

export default class EventsStableOrder extends SvelteComponentTyped<
  EventsStableOrderProps,
  { alpha: CustomEvent<null>; blur: WindowEventMap["blur"]; click: WindowEventMap["click"]; zeta: CustomEvent<null> },
  Record<string, never>
> {}
