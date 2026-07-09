import type { Component } from "svelte";

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

export type BindableDirectionLegacyExports = Record<string, never>;

declare const BindableDirectionLegacy: Component<
  BindableDirectionLegacyProps,
  BindableDirectionLegacyExports,
  "open"
>;
export default BindableDirectionLegacy;
