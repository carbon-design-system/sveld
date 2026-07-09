import { SvelteComponentTyped } from "svelte";

export type BindableDirectionLegacyProps = {
  /**
   * Bind to the current value emitted by the component.
   * @default undefined
   */
  size?: undefined;

  /**
   * Bind to state controlled by either the consumer or component.
   * @default false
   */
  open?: boolean;

  /**
   * Regular unannotated prop.
   * @default "Toggle"
   */
  label?: string;
};

export default class BindableDirectionLegacy extends SvelteComponentTyped<
  BindableDirectionLegacyProps,
  Record<string, any>,
  Record<string, never>
> {}
