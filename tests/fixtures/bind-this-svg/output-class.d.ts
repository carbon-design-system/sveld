import { SvelteComponentTyped } from "svelte";

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

export default class BindThisSvg extends SvelteComponentTyped<
  BindThisSvgProps,
  Record<string, any>,
  Record<string, never>
> {}
