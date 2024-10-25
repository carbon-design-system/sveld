import type { SvelteComponentTyped } from "svelte";

export type InputEventsProps = {};

export default class InputEvents extends SvelteComponentTyped<
  InputEventsProps,
  { input: WindowEventMap["input"]; change: WindowEventMap["change"]; paste: WindowEventMap["paste"] },
  {}
> {}
