/**
 * Modern AST types that used to collapse to `InlineComponent` or `Element`
 * in the legacy tree. Shared so `ComponentParser` and `rest-props` agree.
 */

const COMPONENT_LIKE_TYPES = new Set(["Component", "SvelteComponent", "SvelteSelf"]);
const ELEMENT_LIKE_TYPES = new Set(["RegularElement", "SvelteElement"]);

export function isComponentLikeType(type: string): boolean {
  return COMPONENT_LIKE_TYPES.has(type);
}

export function isElementLikeType(type: string): boolean {
  return ELEMENT_LIKE_TYPES.has(type);
}
