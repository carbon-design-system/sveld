import { SvelteComponentTyped } from "svelte";

export type PropJsdocSinceExampleProps = {
  /**
   * The accessible label for the button.
   * @since 1.4.0
   * @example
   *  ```svelte
   *  <Button label="Save" />
   *  ```
   * @default "Click"
   */
  label?: string;

  /**
   * Visual size token.
   * @since 0.9.0
   * @default "md"
   */
  size?: string;
};

export default class PropJsdocSinceExample extends SvelteComponentTyped<
  PropJsdocSinceExampleProps,
  Record<string, any>,
  Record<string, never>
> {}
