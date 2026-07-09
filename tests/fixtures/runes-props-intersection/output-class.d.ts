import { SvelteComponentTyped } from "svelte";

interface BaseProps {
  label: string;
}

type ExtraProps = {
  disabled?: boolean;
};

type Props = BaseProps & ExtraProps;

type $Props = Props;

export type RunesPropsIntersectionProps = $Props;

export default class RunesPropsIntersection extends SvelteComponentTyped<
  RunesPropsIntersectionProps,
  Record<string, any>,
  Record<string, never>
> {}
