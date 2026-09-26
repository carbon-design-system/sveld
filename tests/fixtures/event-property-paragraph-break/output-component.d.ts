import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type Range = {
  /**
   * First index.
   *
   * Inclusive.
   */
  start: number;
  /** Last index. */
  end: number;
};

export type EventPropertyParagraphBreakProps = {
  /**
   * @default { start: 0, end: 0 }
   */
  range?: Range;
};

export type EventPropertyParagraphBreakExports = Record<string, never>;

type $Events = {
  select: CustomEvent<{
      /**
       * The selected item's id.
       *
       * Stable across re-renders.
       */
      id: string;
      /** The item's position. */
      index: number;
    }>;
};

interface EventPropertyParagraphBreakComponent {
  new (
    options: ComponentConstructorOptions<EventPropertyParagraphBreakProps>
  ): SvelteComponent<EventPropertyParagraphBreakProps, $Events> & EventPropertyParagraphBreakExports;
  (
    this: void,
    internals: ComponentInternals,
    props: EventPropertyParagraphBreakProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<EventPropertyParagraphBreakProps>): void;
  } & EventPropertyParagraphBreakExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const EventPropertyParagraphBreak: EventPropertyParagraphBreakComponent;
export default EventPropertyParagraphBreak;
