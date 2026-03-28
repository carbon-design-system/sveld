import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["input"];

type $Props = {
  [key: `data-${string}`]: unknown;
};

export type EventExplicitNullProps = Omit<$RestProps, keyof $Props> & $Props;

export default class EventExplicitNull extends SvelteComponentTyped<
  EventExplicitNullProps,
  { change: WindowEventMap["change"]; clear: CustomEvent<null>; input: WindowEventMap["input"] },
  Record<string, never>
> {}
