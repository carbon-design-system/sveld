/** AST node types sveld treats as `InlineComponent` or `Element`. */
const COMPONENT_LIKE_TYPES = new Set(["Component", "SvelteComponent", "SvelteSelf"]);
const ELEMENT_LIKE_TYPES = new Set(["RegularElement", "SvelteElement"]);

export function isComponentLikeType(type: string): boolean {
  return COMPONENT_LIKE_TYPES.has(type);
}

export function isElementLikeType(type: string): boolean {
  return ELEMENT_LIKE_TYPES.has(type);
}
