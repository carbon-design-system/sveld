import type { Component } from "svelte";

interface BaseProps {
  label: string;
}

type ExtraProps = {
  disabled?: boolean;
};

type Props = BaseProps & ExtraProps;

type $Props = Props;

export type RunesPropsIntersectionProps = $Props;

export type RunesPropsIntersectionExports = Record<string, never>;

declare const RunesPropsIntersection: Component<
  RunesPropsIntersectionProps,
  RunesPropsIntersectionExports,
  ""
>;
export default RunesPropsIntersection;
