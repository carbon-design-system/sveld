import type { Component } from "svelte";

export type BindableDirectionRunesProps = {
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

export type BindableDirectionRunesExports = Record<string, never>;

declare const BindableDirectionRunes: Component<
  BindableDirectionRunesProps,
  BindableDirectionRunesExports,
  "open"
>;
export default BindableDirectionRunes;
