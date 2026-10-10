import type { Component } from "svelte";

export type BindThisSvgProps = {
  /**
   * @default null
   */
  svgRef?: null | SVGSVGElement;

  /**
   * @default null
   */
  pathRef?: null | SVGPathElement;

  /**
   * @default null
   */
  svgLinkRef?: null | SVGAElement;

  /**
   * @default null
   */
  embeddedLinkRef?: null | HTMLAnchorElement;

  /**
   * @default null
   */
  linkRef?: null | HTMLAnchorElement;
};

export type BindThisSvgExports = Record<string, never>;

declare const BindThisSvg: Component<
  BindThisSvgProps,
  BindThisSvgExports,
  ""
>;
export default BindThisSvg;
