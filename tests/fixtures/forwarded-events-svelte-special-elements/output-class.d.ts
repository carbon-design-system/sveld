import { SvelteComponentTyped } from "svelte";

export type ForwardedEventsSvelteSpecialElementsProps = Record<string, never>;

export default class ForwardedEventsSvelteSpecialElements extends SvelteComponentTyped<
  ForwardedEventsSvelteSpecialElementsProps,
  {
    click: WindowEventMap["click"];
    keydown: WindowEventMap["keydown"];
    visibilitychange: DocumentEventMap["visibilitychange"];
  },
  Record<string, never>
> {}
