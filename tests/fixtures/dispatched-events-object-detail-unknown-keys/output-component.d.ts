import type { Component } from "svelte";

export type DispatchedEventsObjectDetailUnknownKeysProps = {
  oncomputed?: (event: CustomEvent<Record<string, any>>) => void;

  onempty?: (event: CustomEvent<Record<string, never>>) => void;

  onmixed?: (event: CustomEvent<{
        id: number;
        [key: string]: any;
      }>) => void;

  onspread?: (event: CustomEvent<Record<string, any>>) => void;
};

export type DispatchedEventsObjectDetailUnknownKeysExports = Record<string, never>;

declare const DispatchedEventsObjectDetailUnknownKeys: Component<
  DispatchedEventsObjectDetailUnknownKeysProps,
  DispatchedEventsObjectDetailUnknownKeysExports,
  ""
>;
export default DispatchedEventsObjectDetailUnknownKeys;
