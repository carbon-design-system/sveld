import type { Component } from "svelte";

export type DispatchedEventsEscapedUnfollowableProps = {
  /** Fired by `registry.track`. */
  onopen?: (event: CustomEvent<null>) => void;
};

export type DispatchedEventsEscapedUnfollowableExports = Record<string, never>;

declare const DispatchedEventsEscapedUnfollowable: Component<
  DispatchedEventsEscapedUnfollowableProps,
  DispatchedEventsEscapedUnfollowableExports,
  ""
>;
export default DispatchedEventsEscapedUnfollowable;
