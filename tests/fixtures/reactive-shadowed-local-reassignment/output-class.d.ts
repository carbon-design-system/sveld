import { SvelteComponentTyped } from "svelte";

export type ReactiveShadowedLocalReassignmentProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export default class ReactiveShadowedLocalReassignment extends SvelteComponentTyped<
  ReactiveShadowedLocalReassignmentProps,
  Record<string, any>,
  Record<string, never>
> {}
