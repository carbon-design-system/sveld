import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["input"];

type $Props = {
  onchange?: (event: WindowEventMap["change"]) => void;

  onclear?: (event: CustomEvent<null>) => void;

  oninput?: (event: WindowEventMap["input"]) => void;

  [key: `data-${string}`]: unknown;
};

export type EventExplicitNullProps = Omit<$RestProps, keyof $Props> & $Props;

export type EventExplicitNullExports = Record<string, never>;

declare const EventExplicitNull: Component<
  EventExplicitNullProps,
  EventExplicitNullExports,
  ""
>;
export default EventExplicitNull;
