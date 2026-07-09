import { SvelteComponentTyped } from "svelte";

export type CustomElementOptionsTagProps = {
  /**
   * The badge label.
   * @default ""
   */
  label?: string;

  children?: (this: void) => void;
};

export default class CustomElementOptionsTag extends SvelteComponentTyped<
  CustomElementOptionsTagProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
