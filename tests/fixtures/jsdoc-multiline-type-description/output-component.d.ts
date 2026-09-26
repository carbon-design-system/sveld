import type { SvelteComponent, ComponentConstructorOptions, ComponentInternals } from "svelte";

export type Header = {
  /**
   * The intended next sort direction,
   * reported regardless.
   */
  dir?: "ascending"
    | "descending"
    | "none";
  /** Description on the line after the type. */
  prev?: "ascending"
    | "descending";
};

/**
 * Props of any component,
 * spread onto the root.
 */
export type Aliased = import("svelte").ComponentProps<
  import("svelte").SvelteComponent>;

export type Size = "sm"
  | "lg";

export type Formatter = (value: string
    | number) => string
  | undefined;

export type JsdocMultilineTypeDescriptionProps = {
  /**
   * @default {}
   */
  header?: Header;

  /**
   * Props of any component,
   * spread onto the root.
   * @default {}
   */
  aliased?: Aliased;

  /**
   * @default "sm"
   */
  size?: Size;

  /**
   * @default (value) => String(value)
   */
  formatter?: Formatter;

  footer?: (this: void) => void;

  /**
   * Renders one item,
   * with its props.
   */
  item?: (this: void, ...args: [{
        item: string;
        index: number
      }]) => void;
};

export type JsdocMultilineTypeDescriptionExports = {
  /**
   * Formats a value.
   */
  format: (value: string
      | number) => string
    | undefined;
};

type $Events = {
  close: CustomEvent<null>;
  /**
   * Fired when a row is selected,
   * with its position.
   */
  select: CustomEvent<{
      id: string;
      index: number
    }>;
};

interface JsdocMultilineTypeDescriptionComponent {
  new (
    options: ComponentConstructorOptions<JsdocMultilineTypeDescriptionProps>
  ): SvelteComponent<JsdocMultilineTypeDescriptionProps, $Events> & JsdocMultilineTypeDescriptionExports;
  (
    this: void,
    internals: ComponentInternals,
    props: JsdocMultilineTypeDescriptionProps
  ): {
    $on?<K extends keyof $Events & string>(type: K, callback: (e: $Events[K]) => void): () => void;
    $set?(props: Partial<JsdocMultilineTypeDescriptionProps>): void;
  } & JsdocMultilineTypeDescriptionExports;
  element?: typeof HTMLElement;
  z_$$bindings?: "";
}
declare const JsdocMultilineTypeDescription: JsdocMultilineTypeDescriptionComponent;
export default JsdocMultilineTypeDescription;
