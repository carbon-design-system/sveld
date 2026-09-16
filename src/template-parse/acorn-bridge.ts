import { tsPlugin } from "@sveltejs/acorn-typescript";
import type { Node as AcornNode } from "acorn";
import { Parser } from "acorn";
import type { Program } from "estree";
import { attachComments, bindOnComment, type CommentWithLocation, onComment } from "./comments";

/**
 * acorn + `@sveltejs/acorn-typescript`, same as svelte's `phases/1-parse/acorn.js`.
 * Script and expression grammar is JS/TS, not Svelte, so this stays acorn.
 */

/**
 * Records whether a parse produced any `ParenthesizedExpression`, so
 * `parseExpressionAt` only walks the result to unwrap them when one exists.
 * Hooked at the two methods that build one (a `(...)` group that turned out
 * not to be an arrow function's parameter list, and a parenthesized
 * decorator expression) rather than at `finishNode`, which runs for every
 * node and measurably slows small parses.
 */
const parenTracking = { sawParenthesized: false };

// biome-ignore lint/suspicious/noExplicitAny: these methods aren't in acorn's published Parser type; svelte's own acorn.js subclasses the same way
const parenTrackingPlugin = ((BaseParser: any) =>
  class extends BaseParser {
    parseParenAndDistinguishExpression(canBeArrow: boolean, forInit: boolean) {
      const node = super.parseParenAndDistinguishExpression(canBeArrow, forInit);
      if (node.type === "ParenthesizedExpression") parenTracking.sawParenthesized = true;
      return node;
    }

    // acorn-typescript can wrap a decorator's expression in parens as well.
    // Decorators are vanishingly rare in components, so just assume it did.
    parseDecorator() {
      parenTracking.sawParenthesized = true;
      return super.parseDecorator();
    }
  }) as unknown as (BaseParser: typeof Parser) => typeof Parser;

const JSParser = Parser.extend(parenTrackingPlugin);
const TSParser = Parser.extend(tsPlugin(), parenTrackingPlugin);

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

// `@sveltejs/acorn-typescript` forces `locations: true`. With locations on
// and a non-zero start offset, acorn's constructor counts the lines before
// the offset by slicing and splitting the whole prefix, once per expression,
// so a template's expression parses cost O(n) each in the file size. Passing
// `startLocation` skips that; the line/column come from a per-source table.
// (`parseStatementAt` constructs the parser directly, bypassing the plugin's
// static entry points that force `locations`, so it never counts lines.)
const TS_EXPRESSION_OPTIONS = { ...EXPRESSION_OPTIONS, startLocation: null as StartLocation | null };

interface StartLocation {
  line: number;
  column: number;
}

// acorn's `lineBreak`; its constructor counts lines with exactly this.
const LINE_BREAK_REGEX = /\r\n?|\n|\u2028|\u2029/g;

/**
 * Per-source cache of line-break end offsets, owned by the caller (the
 * template parser state) so no source-string comparison is needed to reuse
 * it. Callers parsing a one-off synthetic source pass nothing and pay for
 * one scan.
 */
export interface LineTable {
  /** End offset of every line break in the source, ascending. */
  breakEnds?: number[];
}

function lineBreakEnds(source: string, lineTable: LineTable | undefined): number[] {
  if (lineTable?.breakEnds) return lineTable.breakEnds;
  const ends: number[] = [];
  LINE_BREAK_REGEX.lastIndex = 0;
  while (LINE_BREAK_REGEX.test(source)) ends.push(LINE_BREAK_REGEX.lastIndex);
  if (lineTable) lineTable.breakEnds = ends;
  return ends;
}

/**
 * `{ line, column }` for `index` in `source`, equal to what acorn would
 * compute itself: `column` counts from the last `\n`, `line` is one more
 * than the number of line breaks before that point.
 */
function startLocationFor(source: string, index: number, lineTable: LineTable | undefined): StartLocation {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;

  // Number of breaks ending at or before `lineStart`.
  const ends = lineBreakEnds(source, lineTable);
  let low = 0;
  let high = ends.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (ends[mid] <= lineStart) low = mid + 1;
    else high = mid;
  }

  return { line: low + 1, column: index - lineStart };
}

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
  lineTable?: LineTable,
) {
  acornExpressionParses.count += 1;
  const commentsBefore = comments.length;
  bindOnComment(source, comments);

  parenTracking.sawParenthesized = false;
  let options = EXPRESSION_OPTIONS;
  if (isTypeScript) {
    TS_EXPRESSION_OPTIONS.startLocation = startLocationFor(source, index, lineTable);
    options = TS_EXPRESSION_OPTIONS;
  }
  const node = parserFor(isTypeScript).parseExpressionAt(source, index, options);

  attachNewComments(node as unknown as Parameters<typeof attachComments>[0], source, comments, index, commentsBefore);

  // A trailing comment past the expression, e.g. `{x /* c */}`, has to extend
  // how far the caller advances. Same as svelte's `read_expression`.
  const lastComment = comments.length > commentsBefore ? comments.at(-1) : undefined;
  const end = lastComment && lastComment.end > (node.end ?? 0) ? lastComment.end : (node.end ?? 0);

  // Most expressions (including calls and arrow functions, which do contain
  // `(`) produce no `ParenthesizedExpression`; skip the unwrapping tree walk
  // unless the parser actually finished one.
  const parsed = parenTracking.sawParenthesized ? removeParens(node) : node;

  return { node: parsed, end };
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

interface WalkableAcornNode {
  type: string;
  expression?: WalkableAcornNode;
  [key: string]: unknown;
}

function isWalkableNode(value: unknown): value is WalkableAcornNode {
  return value !== null && typeof value === "object" && typeof (value as WalkableAcornNode).type === "string";
}

/** `node` with every `ParenthesizedExpression` layer peeled off. */
function unwrapParens(node: WalkableAcornNode): WalkableAcornNode {
  let inner = node;
  while (inner.type === "ParenthesizedExpression" && inner.expression) inner = inner.expression;
  return inner;
}

/**
 * `preserveParens: true` leaves `ParenthesizedExpression` wrappers in.
 * svelte's public AST never exposes them. Unwrap in place, matching svelte's
 * `remove_parens` in `phases/1-parse/acorn.js`. Same traversal as the
 * parser's other walks: own enumerable keys in order, a child is any object
 * with a string `type`, directly or inside an array.
 */
function removeParens<T extends AcornNode>(node: T): T {
  const root = unwrapParens(node as unknown as WalkableAcornNode);
  removeParensInChildren(root);
  return root as unknown as T;
}

function removeParensInChildren(node: WalkableAcornNode): void {
  for (const key in node) {
    const value = node[key];
    if (!value || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (!isWalkableNode(item)) continue;
        const replacement = unwrapParens(item);
        if (replacement !== item) value[i] = replacement;
        removeParensInChildren(replacement);
      }
    } else if (isWalkableNode(value)) {
      const replacement = unwrapParens(value);
      if (replacement !== value) node[key] = replacement;
      removeParensInChildren(replacement);
    }
  }
}
