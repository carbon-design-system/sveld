import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsSvelteWindowProps = Record<string, never>;

export default class ForwardedEventsSvelteWindow extends SvelteComponentTyped<
  ForwardedEventsSvelteWindowProps,
  {
    click: WindowEventMap["click"];
    keydown: WindowEventMap["keydown"];
  },
  Record<string, never>
> {}
