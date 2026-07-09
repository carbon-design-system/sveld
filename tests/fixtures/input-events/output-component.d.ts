import type { Component } from "svelte";

export type InputEventsProps = {
  onchange?: (event: WindowEventMap["change"]) => void;

  oninput?: (event: WindowEventMap["input"]) => void;

  onpaste?: (event: WindowEventMap["paste"]) => void;
};

export type InputEventsExports = Record<string, never>;

declare const InputEvents: Component<
  InputEventsProps,
  InputEventsExports,
  ""
>;
export default InputEvents;
