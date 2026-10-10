import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type ForwardedStandardEventCustomDetailProps = {
  /**
   * @default []
   */
  files?: any[];
};

export type ForwardedStandardEventCustomDetailExports = Record<string, never>;

type $Events = {
  add: CustomEvent<ReadonlyArray<File>>;
  change: CustomEvent<ReadonlyArray<File>>;
  remove: CustomEvent<ReadonlyArray<File>>;
};

interface ForwardedStandardEventCustomDetailComponent {
  new (
    options: ComponentConstructorOptions<ForwardedStandardEventCustomDetailProps>
  ): SvelteComponent<ForwardedStandardEventCustomDetailProps, $Events> & ForwardedStandardEventCustomDetailExports;
  (
    this: void,
    internals: ComponentInternals,
    props: ForwardedStandardEventCustomDetailProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<ForwardedStandardEventCustomDetailProps>): void;
  } & ForwardedStandardEventCustomDetailExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const ForwardedStandardEventCustomDetail: ForwardedStandardEventCustomDetailComponent;
export default ForwardedStandardEventCustomDetail;
