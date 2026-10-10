import { SvelteComponentTyped } from "svelte";

export type DispatchedEventsTernaryTemplateProps = {
  /**
   * @default false
   */
  open?: boolean;
};

export default class DispatchedEventsTernaryTemplate extends SvelteComponentTyped<
  DispatchedEventsTernaryTemplateProps,
  {
    close: CustomEvent<{ trigger: string }>;
    "mouseenter:trigger": CustomEvent<MouseEvent>;
    open: CustomEvent<{ trigger: string }>;
    stale: CustomEvent<null>;
  },
  Record<string, never>
> {}
