import { SvelteComponentTyped } from "svelte";

export type ReactiveShadowedLocalAssignmentProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export default class ReactiveShadowedLocalAssignment extends SvelteComponentTyped<
  ReactiveShadowedLocalAssignmentProps,
  Record<string, any>,
  Record<string, never>
> {}
