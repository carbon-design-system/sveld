import { SvelteComponentTyped } from "svelte";

export type BindThisSvgNamespaceProps = {
  /**
   * @default null
   */
  linkRef?: null | SVGAElement;

  /**
   * @default null
   */
  groupRef?: null | SVGGElement;
};

export default class BindThisSvgNamespace extends SvelteComponentTyped<
  BindThisSvgNamespaceProps,
  Record<string, any>,
  Record<string, never>
> {}
