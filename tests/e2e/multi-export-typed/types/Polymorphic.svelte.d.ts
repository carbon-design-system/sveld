import { SvelteComponentTyped, type ComponentConstructorOptions } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps<Tag extends keyof HTMLElementTagNameMap = "div"> = NoInfer<SvelteHTMLElements[Tag]>;

type $Props<Tag extends keyof HTMLElementTagNameMap = "div"> = {
  /**
   * Specify the element to render.
   * @default "div"
   */
  tag?: Tag;

  /**
   * Span the container. Named as an attribute of some elements (`img`),
   * which it replaces there.
   * @default false
   */
  width?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type PolymorphicProps<Tag extends keyof HTMLElementTagNameMap = "div"> = (Tag extends "canvas" | "col" | "embed" | "iframe" | "img" | "input" | "object" | "source" | "table" | "td" | "video" ? Omit<$RestProps<Tag>, keyof $Props<Tag>> : $RestProps<Tag>) & $Props<Tag>;

export default class Polymorphic<Tag extends keyof HTMLElementTagNameMap = "div"> extends SvelteComponentTyped<
  PolymorphicProps<Tag>,
  Record<string, any>,
  { default: Record<string, never> }
> {
  constructor(options: ComponentConstructorOptions<PolymorphicProps<Tag>>);
}
