import type { Component } from "svelte";

interface Props {
  /** Badge label */
  label: string;
  /**
   * Visual tone
   * @deprecated Use `variant` instead.
   */
  tone?: "info" | "warn";
}

type $Props = Props;

export type RunesPropsInterfaceJsdocProps = $Props;

export type RunesPropsInterfaceJsdocExports = Record<string, never>;

declare const RunesPropsInterfaceJsdoc: Component<
  RunesPropsInterfaceJsdocProps,
  RunesPropsInterfaceJsdocExports,
  ""
>;
export default RunesPropsInterfaceJsdoc;
