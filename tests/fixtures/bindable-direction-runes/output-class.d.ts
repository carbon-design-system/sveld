import { SvelteComponentTyped } from "svelte";

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

export default class BindableDirectionRunes extends SvelteComponentTyped<
  BindableDirectionRunesProps,
  Record<string, any>,
  Record<string, never>
> {}
