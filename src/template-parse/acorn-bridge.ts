import { tsPlugin } from "@sveltejs/acorn-typescript";
import type { Node as AcornNode } from "acorn";
import { Parser } from "acorn";
import type { Program } from "estree";
import { walk } from "zimmerframe";
import { attachComments, bindOnComment, type CommentWithLocation, onComment } from "./comments";

/**
 * acorn + `@sveltejs/acorn-typescript`, same as svelte's `phases/1-parse/acorn.js`.
 * Script and expression grammar is JS/TS, not Svelte, so this stays acorn.
 */

const JSParser = Parser;
const TSParser = JSParser.extend(tsPlugin());

function parserFor(isTypeScript: boolean) {
  return isTypeScript ? TSParser : JSParser;
}

// Reused every call. bindOnComment retargets `onComment` first.
const PROGRAM_OPTIONS = {
  onComment,
  sourceType: "module",
  ecmaVersion: 16,
  // biome-ignore lint/suspicious/noExplicitAny: acorn's own option types don't expose onComment
} as any;

const EXPRESSION_OPTIONS = {
  onComment,
  sourceType: "module",
  ecmaVersion: 16,
  preserveParens: true,
  // biome-ignore lint/suspicious/noExplicitAny: acorn's own option types don't expose this
} as any;

const STATEMENT_OPTIONS = {
  onComment,
  sourceType: "module",
  ecmaVersion: 16,
  // biome-ignore lint/suspicious/noExplicitAny: see PROGRAM_OPTIONS
} as any;

function attachNewComments(
  node: Parameters<typeof attachComments>[0],
  source: string,
  comments: CommentWithLocation[],
  fromIndex: number,
  commentsBefore: number,
) {
  // Most `{expr}` tags have no comments. Skip the Object.keys AST walk.
  if (comments.length === commentsBefore) return;
  attachComments(node, source, comments, fromIndex);
}

/** Parses a `<script>` / `<script module>` body into a `Program` at `index` in `fullSource`. */
export function parseProgram(fullSource: string, isTypeScript: boolean, comments: CommentWithLocation[]): Program {
  const commentsBefore = comments.length;
  bindOnComment(fullSource, comments);

  const ast = parserFor(isTypeScript).parse(fullSource, PROGRAM_OPTIONS) as unknown as Program;

  // Skip the Program walk when no comments exist yet.
  if (comments.length > 0) {
    attachComments(ast as unknown as Parameters<typeof attachComments>[0], fullSource, comments, commentsBefore);
  }
  return ast;
}

/**
 * Counts calls to `parseExpressionAt` so tests can assert whether the
 * trivial-expression fast path in `expression.ts` fired (count unchanged)
 * or fell back to acorn (count grew). Not reset by production code.
 */
export const acornExpressionParses = { count: 0 };

/** Parses one expression starting at `index`, e.g. the contents of `{...}`. */
export function parseExpressionAt(
  source: string,
  index: number,
  isTypeScript: boolean,
  comments: CommentWithLocation[],
) {
  acornExpressionParses.count += 1;
  const commentsBefore = comments.length;
  bindOnComment(source, comments);

  const node = parserFor(isTypeScript).parseExpressionAt(source, index, EXPRESSION_OPTIONS);

  attachNewComments(node as unknown as Parameters<typeof attachComments>[0], source, comments, index, commentsBefore);

  // A trailing comment past the expression, e.g. `{x /* c */}`, has to extend
  // how far the caller advances. Same as svelte's `read_expression`.
  const lastComment = comments.length > commentsBefore ? comments.at(-1) : undefined;
  const end = lastComment && lastComment.end > (node.end ?? 0) ? lastComment.end : (node.end ?? 0);

  // `ParenthesizedExpression` only exists where the source has a literal `(`.
  // Most expressions don't, so skip zimmerframe's tree walk.
  const nodeEnd = node.end ?? index;
  const parsed = hasCharInRange(source, index, nodeEnd, 40 /* "(" */) ? removeParens(node) : node;

  return { node: parsed, end };
}

function hasCharInRange(source: string, start: number, end: number, charCode: number): boolean {
  for (let i = start; i < end; i++) {
    if (source.charCodeAt(i) === charCode) return true;
  }
  return false;
}

/**
 * Parses one statement at `index` for the `{let ...}` / `{const ...}`
 * speculative parse. Leaves the caller's cursor alone. Caller keeps or
 * discards the statement.
 */
export function parseStatementAt(
  source: string,
  index: number,
  isTypeScript: boolean,
  comments: CommentWithLocation[],
) {
  const commentsBefore = comments.length;
  const ParserClass = parserFor(isTypeScript);
  bindOnComment(source, comments);
  // Constructing a raw Parser to call unexported parseStatement isn't in
  // acorn's public types. svelte's own acorn.js does the same cast.
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  const parser = new (ParserClass as any)(STATEMENT_OPTIONS, source, index);
  parser.nextToken();
  const statement = parser.parseStatement(null, true, Object.create(null));
  attachNewComments(
    statement as unknown as Parameters<typeof attachComments>[0],
    source,
    comments,
    index,
    commentsBefore,
  );
  return statement;
}

/**
 * `preserveParens: true` leaves `ParenthesizedExpression` wrappers in.
 * svelte's public AST never exposes them. Unwrap, matching svelte's
 * `remove_parens` in `phases/1-parse/acorn.js`.
 */
function removeParens<T extends AcornNode>(node: T): T {
  return walk(node as unknown as { type: string }, null, {
    ParenthesizedExpression(node: { expression: unknown }, context: { visit: (n: unknown) => unknown }) {
      return context.visit(node.expression);
    },
    // biome-ignore lint/suspicious/noExplicitAny: zimmerframe's visitor map is keyed by arbitrary node type strings
  } as any) as unknown as T;
}
