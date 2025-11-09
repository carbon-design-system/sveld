import type { SvelteComponentTyped } from "svelte";

export type ButtonProps = {
  /**
   * Button text
   * @default "Click me"
   */
  text?: string;

  /**
   * Button size
   * @default "medium"
   */
  size?: string;
};

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  Record<string, any>,
  Record<string, never>
> {}
