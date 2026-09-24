import { SvelteComponentTyped } from "svelte";

export type LegacyPanelProps = {
  title: string;
};

export default class LegacyPanel extends SvelteComponentTyped<
  LegacyPanelProps,
  {
    click: WindowEventMap["click"];
    close: CustomEvent<{ reason: string }>;
  },
  Record<string, never>
> {}
