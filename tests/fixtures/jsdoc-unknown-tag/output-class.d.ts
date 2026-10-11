import { SvelteComponentTyped } from "svelte";

export type JsdocUnknownTagProps = {
  /**
   * The label.
   * @depreacted Use `text` instead.
   * @default ""
   */
  label?: string;

  /**
   * A custom tag with no close match.
   * @remarks Kept with the description.
   * @default ""
   */
  text?: string;
};

export default class JsdocUnknownTag extends SvelteComponentTyped<
  JsdocUnknownTagProps,
  Record<string, any>,
  Record<string, never>
> {}
