import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type DispatchedEventsTernaryTemplateProps = {
  /**
   * @default false
   */
  open?: boolean;
};

export type DispatchedEventsTernaryTemplateExports = Record<string, never>;

type $Events = {
  close: CustomEvent<{ trigger: string }>;
  "mouseenter:trigger": CustomEvent<MouseEvent>;
  open: CustomEvent<{ trigger: string }>;
  stale: CustomEvent<null>;
};

interface DispatchedEventsTernaryTemplateComponent {
  new (
    options: ComponentConstructorOptions<DispatchedEventsTernaryTemplateProps>
  ): SvelteComponent<DispatchedEventsTernaryTemplateProps, $Events> & DispatchedEventsTernaryTemplateExports;
  (
    this: void,
    internals: ComponentInternals,
    props: DispatchedEventsTernaryTemplateProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<DispatchedEventsTernaryTemplateProps>): void;
  } & DispatchedEventsTernaryTemplateExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const DispatchedEventsTernaryTemplate: DispatchedEventsTernaryTemplateComponent;
export default DispatchedEventsTernaryTemplate;
