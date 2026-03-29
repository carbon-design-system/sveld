import { SvelteComponentTyped } from "svelte";

export type RunesCallbackAnnotatedProps = {
  /**
   * Snowball event fired when throwing a snowball.
   */
  onsnowball: (detail: { isPacked: boolean; speed: number; color?: string; density?: number }) => void;

  /**
   * Will be fired if value has been changed
   */
  onchange: () => void;

  /**
   * Form submission with value
   */
  onsubmit: (detail: { value: string }) => void;
};

export default class RunesCallbackAnnotated extends SvelteComponentTyped<
  RunesCallbackAnnotatedProps,
  Record<string, any>,
  Record<string, never>
> {}
