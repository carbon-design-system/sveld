import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type LegacyPanelProps = {
  title: string;
};

export type LegacyPanelExports = Record<string, never>;

type $Events = {
  click: WindowEventMap["click"];
  close: CustomEvent<{ reason: string }>;
};

interface LegacyPanelComponent {
  new (
    options: ComponentConstructorOptions<LegacyPanelProps>
  ): SvelteComponent<LegacyPanelProps, $Events> & LegacyPanelExports;
  (
    this: void,
    internals: ComponentInternals,
    props: LegacyPanelProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<LegacyPanelProps>): void;
  } & LegacyPanelExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const LegacyPanel: LegacyPanelComponent;
export default LegacyPanel;
