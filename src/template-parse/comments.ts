/**
 * Attaches JS comments from `<script>` and `{expression}` onto AST nodes.
 * From svelte's `get_comment_handlers` in `phases/1-parse/acorn.js`.
 *
 * Only `leadingComments` are stored. That's what `processNodeJSDoc` reads.
 * Trailing comments still get claimed so they don't leak onto a later node's
 * leading list, but they aren't kept.
 */

const REGEX_HAS_NEWLINE = /\n/;
const REGEX_LEADING_WHITESPACE_CHAR = /[ \t]/;
const REGEX_TRAILING_COMMA_PAREN_WHITESPACE = /^[,) \t]*$/;

export interface CommentWithLocation {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

interface WalkableNode {
  type: string;
  start?: number;
  end?: number;
  leadingComments?: CommentWithLocation[];
  [key: string]: unknown;
}

let commentSource = "";
let commentSink: CommentWithLocation[] = [];

/**
 * Points the shared acorn `onComment` handler at this parse. The function
 * identity is stable so parse option objects can be reused.
 */
export function bindOnComment(source: string, comments: CommentWithLocation[]): void {
  commentSource = source;
  commentSink = comments;
}

export function onComment(block: boolean, rawValue: string, start: number, end: number) {
  let value = rawValue;

  if (block && REGEX_HAS_NEWLINE.test(value)) {
    let a = start;
    while (a > 0 && commentSource[a - 1] !== "\n") a -= 1;
    let b = a;
    while (REGEX_LEADING_WHITESPACE_CHAR.test(commentSource[b])) b += 1;
    const indentation = commentSource.slice(a, b);
    value = stripLeadingIndentation(value, indentation);
  }

  commentSink.push({ type: block ? "Block" : "Line", value, start, end });
}

/**
 * Strips a fixed `indentation` prefix from every line. Same as
 * `value.replace(new RegExp("^" + escaped(indentation), "gm"), "")`, without
 * compiling a regex per JSDoc block.
 */
function stripLeadingIndentation(value: string, indentation: string): string {
  if (indentation === "") return value;
  const lines = value.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(indentation)) lines[i] = lines[i].slice(indentation.length);
  }
  return lines.join("\n");
}

/**
 * Walks `node` and attaches comments with `start >= fromIndex` as
 * `leadingComments`. Mutates nodes, not the `comments` array. Comments
 * arrive in `start` order, so finding the first one is a binary search.
 */
export function attachComments(
  node: WalkableNode,
  source: string,
  comments: CommentWithLocation[],
  fromIndex: number,
): void {
  const startIndex = lowerBound(comments, fromIndex);
  if (startIndex >= comments.length) return;

  walkAndAttach(node, undefined, comments, { index: startIndex }, source);
}

/** First index `i` in the ascending-sorted `comments` with `comments[i].start >= fromIndex`. */
function lowerBound(comments: CommentWithLocation[], fromIndex: number): number {
  let lo = 0;
  let hi = comments.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (comments[mid].start < fromIndex) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function walkAndAttach(
  node: WalkableNode,
  parent: WalkableNode | undefined,
  comments: CommentWithLocation[],
  cursor: { index: number },
  source: string,
): void {
  while (cursor.index < comments.length && comments[cursor.index].start < (node.start ?? 0)) {
    node.leadingComments ??= [];
    node.leadingComments.push(comments[cursor.index]);
    cursor.index++;
  }

  // Nothing left to attach. Skip walking the rest of this script AST.
  if (cursor.index >= comments.length) return;

  for (const child of childNodes(node)) {
    walkAndAttach(child, node, comments, cursor, source);
  }

  // Claim trailing comments the same way svelte does, so they aren't left
  // for a later sibling's leading list. Skip them rather than store them.
  if (cursor.index < comments.length) {
    const nextComment = comments[cursor.index];
    if (parent === undefined || node.end !== parent.end) {
      const slice = source.slice(node.end ?? 0, nextComment.start);
      const isLastInBody =
        ((parent?.type === "BlockStatement" || parent?.type === "Program") &&
          isLastOf(parent.body as unknown[], node)) ||
        (parent?.type === "ArrayExpression" && isLastOf(parent.elements as unknown[], node)) ||
        (parent?.type === "ObjectExpression" && isLastOf(parent.properties as unknown[], node));

      if (isLastInBody) {
        while (cursor.index < comments.length) {
          if (parent && comments[cursor.index].start >= (parent.end ?? Number.POSITIVE_INFINITY)) break;
          cursor.index++;
        }
      } else if ((node.end ?? 0) <= nextComment.start && REGEX_TRAILING_COMMA_PAREN_WHITESPACE.test(slice)) {
        cursor.index++;
      }
    }
  }
}

function isLastOf(list: unknown[] | undefined, node: unknown): boolean {
  return !!list && list.indexOf(node) === list.length - 1;
}

/** Direct object/array-of-node children that have a `.type`. Same walk rule as zimmerframe. */
function childNodes(node: WalkableNode): WalkableNode[] {
  const children: WalkableNode[] = [];
  // `Object.keys` instead of `for...in`. Acorn nodes don't put enumerable
  // properties on the prototype, and this runs once per node.
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "leadingComments") continue;
    const value = node[key];
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as WalkableNode).type === "string") {
          children.push(item as WalkableNode);
        }
      }
    } else if (typeof (value as WalkableNode).type === "string") {
      children.push(value as WalkableNode);
    }
  }
  return children;
}
