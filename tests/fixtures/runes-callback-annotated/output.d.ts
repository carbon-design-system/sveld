import { SvelteComponentTyped } from "svelte";

export type RunesCallbackAnnotatedProps = {
  /**
   * @default undefined
   */
  onsnowball: undefined;

  /**
   * @default undefined
   */
  onchange: undefined;

  /**
   * @default undefined
   */
  onsubmit: undefined;
};

export default class RunesCallbackAnnotated extends SvelteComponentTyped<
  RunesCallbackAnnotatedProps,
  {
    /** Will be fired if value has been changed */
    change: CustomEvent<null>;
    /** Snowball event fired when throwing a snowball. */
    snowball: CustomEvent<{
      /** Indicates whether the snowball is tightly packed. */
      isPacked: boolean;
      /** The speed of the snowball in mph. */
      speed: number;
      /** Optional color of the snowball. */
      color?: string;
      /** Optional density with default value. @default 0.9 */
      density?: number;
    }>;
    /** Form submission with value */
    submit: CustomEvent<{ value: string }>;
  },
  Record<string, never>
> {}
