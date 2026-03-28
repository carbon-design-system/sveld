import { SvelteComponentTyped } from "svelte";

export type InputEventsProps = Record<string, never>;

export default class InputEvents extends SvelteComponentTyped<
  InputEventsProps,
  { change: WindowEventMap["change"]; input: WindowEventMap["input"]; paste: WindowEventMap["paste"] },
  Record<string, never>
> {}
