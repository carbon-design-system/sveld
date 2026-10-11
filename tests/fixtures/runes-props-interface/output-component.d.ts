import type { Component } from "svelte";

interface Props {
  /** Badge label */
  label: string;
  /**
   * Visual tone
   * @deprecated Use `variant` instead.
   */
  tone?: "info" | "warn";
  count?: number;
}

type $Props = Props;

export type RunesPropsInterfaceProps = $Props;

export type RunesPropsInterfaceExports = Record<string, never>;

declare const RunesPropsInterface: Component<
  RunesPropsInterfaceProps,
  RunesPropsInterfaceExports,
  ""
>;
export default RunesPropsInterface;
