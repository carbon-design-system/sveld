import { SvelteComponentTyped } from "svelte";

export type RunesEventCallbackPropsProps = {
  /**
   * Fired when a value is saved.
   */
  onsave: (detail: { id: string }) => void;

  onclose: () => void;
};

export default class RunesEventCallbackProps extends SvelteComponentTyped<
  RunesEventCallbackPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
