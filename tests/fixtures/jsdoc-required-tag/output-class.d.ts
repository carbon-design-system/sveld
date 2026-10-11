import { SvelteComponentTyped } from "svelte";

export type JsdocRequiredTagProps = {
  /**
   * @required
   * @default true
   */
  prop?: boolean;

  /**
   * This is a comment.
   * @required
   * @default true
   */
  prop1?: boolean | string;

  prop2: any;

  prop3: boolean;

  children?: (this: void, ...args: [{
        prop: boolean;
        prop1: boolean | string;
        prop2: any;
        prop3: boolean;
      }]) => void;
};

export default class JsdocRequiredTag extends SvelteComponentTyped<
  JsdocRequiredTagProps,
  Record<string, any>,
  {
    default: {
      prop: boolean;
      prop1: boolean | string;
      prop2: any;
      prop3: boolean;
    };
  }
> {}
