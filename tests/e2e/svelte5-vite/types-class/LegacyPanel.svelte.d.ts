import { SvelteComponentTyped } from "svelte";

export type LegacyPanelProps = {
  /**
   * @default undefined
   */
  title: string;
};

export default class LegacyPanel extends SvelteComponentTyped<
  LegacyPanelProps,
  {
    click: WindowEventMap["click"];
    close: CustomEvent<any>;
  },
  Record<string, never>
> {}
