import { SvelteComponentTyped } from "svelte";

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

export default class RunesPropsInterfaceJsdoc extends SvelteComponentTyped<
  RunesPropsInterfaceJsdocProps,
  Record<string, any>,
  Record<string, never>
> {}
