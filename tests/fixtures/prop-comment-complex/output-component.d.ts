import type { Component } from "svelte";

export type PropCommentComplexProps = {
  /**
   * Specify the switch text.
   * Alternatively, use the default slot.
   * @example
   *  ```svelte
   *  <Switch>
   *    <span>Custom Text</span>
   *  </Switch>
   *  ```
   * @default ""
   */
  text?: string;

  /**
   * Specify the icon to render.
   * Alternatively, use the named slot "icon".
   * @example
   *  ```svelte
   *  <Button>
   *    <Icon slot="icon" size={20} />
   *  </Button>
   *  ```
   * @default undefined
   */
  icon?: any;

  children?: (this: void, ...args: [{
        text: string;
        icon: any;
      }]) => void;
};

export type PropCommentComplexExports = Record<string, never>;

declare const PropCommentComplex: Component<
  PropCommentComplexProps,
  PropCommentComplexExports,
  ""
>;
export default PropCommentComplex;
