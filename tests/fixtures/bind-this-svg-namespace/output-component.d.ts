import type { Component } from "svelte";

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

export type BindThisSvgNamespaceExports = Record<string, never>;

declare const BindThisSvgNamespace: Component<
  BindThisSvgNamespaceProps,
  BindThisSvgNamespaceExports,
  ""
>;
export default BindThisSvgNamespace;
