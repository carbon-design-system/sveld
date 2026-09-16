/**
 * Minimal pre/post-order AST walk for the parser's read-only passes.
 *
 * Same traversal as `estree-walker`'s `walk` (own enumerable keys in
 * insertion order; a child is any object with a string `type`, directly or
 * inside an array), minus the skip/replace/remove machinery those passes
 * never use. `leadingComments` entries carry `type: "Block" | "Line"`, so
 * `estree-walker` would visit them as nodes; nothing here reads them, so
 * they're skipped.
 */

export interface WalkableNode {
  type: string;
  [key: string]: unknown;
}

export type WalkEnter = (node: WalkableNode, parent: WalkableNode | null, prop: string | null) => void;
export type WalkLeave = (node: WalkableNode) => void;

export interface WalkOptions {
  /**
   * Don't descend into type-level TS subtrees (see {@link isTypeOnlySubtree}).
   * The node itself is still entered and left. For passes that only care
   * about value-level nodes, this skips what is often the largest part of a
   * typed component's script (a `Props` type literal with one member per
   * prop).
   */
  skipTypeOnlySubtrees?: boolean;
}

/**
 * TS nodes whose entire subtree is type-level: annotations, type aliases,
 * interfaces, and type parameter lists. Nothing under them is a value-level
 * node (no calls, declarations, assignments, or scopes).
 */
export function isTypeOnlySubtree(type: string): boolean {
  return (
    type === "TSTypeAnnotation" ||
    type === "TSTypeAliasDeclaration" ||
    type === "TSInterfaceDeclaration" ||
    type === "TSTypeParameterDeclaration" ||
    type === "TSTypeParameterInstantiation"
  );
}

export function walkNodes(root: WalkableNode, enter: WalkEnter, leave?: WalkLeave, options?: WalkOptions): void {
  visit(root, null, null, enter, leave, options?.skipTypeOnlySubtrees === true);
}

function visit(
  node: WalkableNode,
  parent: WalkableNode | null,
  prop: string | null,
  enter: WalkEnter,
  leave: WalkLeave | undefined,
  skipTypeOnly: boolean,
): void {
  enter(node, parent, prop);

  // Leaves first: identifiers and literals are the bulk of any AST and have
  // no child nodes, so skip enumerating their keys. An identifier with a TS
  // `typeAnnotation` (or a literal with one, e.g. a typed default) does have
  // one, so those still take the general path.
  const type = node.type;
  if ((type === "Identifier" || type === "Literal" || type === "Text") && node.typeAnnotation === undefined) {
    if (leave) leave(node);
    return;
  }
  if (skipTypeOnly && type.charCodeAt(0) === 84 /* T */ && isTypeOnlySubtree(type)) {
    if (leave) leave(node);
    return;
  }

  // `for...in` on acorn/svelte nodes: plain objects, no enumerable prototype keys.
  for (const key in node) {
    if (key === "leadingComments") continue;
    const value = node[key];
    if (!value || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === "object" && typeof (item as WalkableNode).type === "string") {
          visit(item as WalkableNode, node, key, enter, leave, skipTypeOnly);
        }
      }
    } else if (typeof (value as WalkableNode).type === "string") {
      visit(value as WalkableNode, node, key, enter, leave, skipTypeOnly);
    }
  }

  if (leave) leave(node);
}
