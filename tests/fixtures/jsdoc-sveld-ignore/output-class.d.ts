import { SvelteComponentTyped } from "svelte";

export type JsdocSveldIgnoreProps = {
  /**
   * Suppresses only the named diagnostic.
   * @default compute()
   */
  ignored?: any;

  /**
   * A bare tag suppresses every diagnostic for the prop.
   * @default compute()
   */
  ignoredAll?: any;

  /**
   * A different code leaves this prop's diagnostic in place.
   * @default compute()
   */
  otherCode?: any;

  /**
   * @default compute()
   */
  reported?: any;
};

export default class JsdocSveldIgnore extends SvelteComponentTyped<
  JsdocSveldIgnoreProps,
  Record<string, any>,
  Record<string, never>
> {}
