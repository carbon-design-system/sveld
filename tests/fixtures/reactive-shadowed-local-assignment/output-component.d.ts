import type { Component } from "svelte";

export type ReactiveShadowedLocalAssignmentProps = {
  /**
   * @default false
   */
  disabled?: boolean;
};

export type ReactiveShadowedLocalAssignmentExports = Record<string, never>;

declare const ReactiveShadowedLocalAssignment: Component<
  ReactiveShadowedLocalAssignmentProps,
  ReactiveShadowedLocalAssignmentExports,
  ""
>;
export default ReactiveShadowedLocalAssignment;
