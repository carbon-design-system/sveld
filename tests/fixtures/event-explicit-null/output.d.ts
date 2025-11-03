import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["input"];

type $Props = {
  [key: `data-${string}`]: any;
};

export type EventExplicitNullProps = Omit<$RestProps, keyof $Props> & $Props;

export default class EventExplicitNull extends SvelteComponentTyped<
  EventExplicitNullProps,
  { clear: CustomEvent<null>; change: WindowEventMap["change"]; input: WindowEventMap["input"] },
  Record<string, never>
> {}
