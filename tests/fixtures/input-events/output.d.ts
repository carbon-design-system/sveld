import { SvelteComponentTyped } from "svelte";

export type InputEventsProps = Record<string, never>;

export default class InputEvents extends SvelteComponentTyped<
  InputEventsProps,
  { input: WindowEventMap["input"]; change: WindowEventMap["change"]; paste: WindowEventMap["paste"] },
  Record<string, never>
> {}
