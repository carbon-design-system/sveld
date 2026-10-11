import { SvelteComponentTyped } from "svelte";

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

export default class RunesPropsInterface extends SvelteComponentTyped<
  RunesPropsInterfaceProps,
  Record<string, any>,
  Record<string, never>
> {}
