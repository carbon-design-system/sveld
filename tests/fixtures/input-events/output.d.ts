import type { SvelteComponentTyped } from "svelte";

export interface InputEventsProps {}

export default class InputEvents extends SvelteComponentTyped<
  InputEventsProps,
  {
    input: WindowEventMap["input"];
    change: WindowEventMap["change"];
    paste: DocumentAndElementEventHandlersEventMap["paste"];
  },
  {}
> {}
