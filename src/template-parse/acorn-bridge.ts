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

/**
 * Records whether a parse produced any `ParenthesizedExpression`, so
 * `parseExpressionAt` only walks the result to unwrap them when one exists.
 * Every node passes through `finishNode`, so the check is one comparison
 * per node instead of a tree walk per parenthesized-looking expression.
 */
const parenTracking = { sawParenthesized: false };

/**
 * Counts the TS value-level wrapper nodes (`x as T`, `x satisfies T`, `x!`,
 * `<T>x`, `f<T>`) any parse has produced. `parse()` compares it before and
 * after a component to learn whether `stripTypeCastWrappers` has anything
 * to do; most TS components have none, and the strip is a full AST walk.
 */
export const typeCastWrapperNodes = { count: 0 };

function isTypeCastWrapperType(type: string): boolean {
  return (
    type === "TSAsExpression" ||
    type === "TSSatisfiesExpression" ||
    type === "TSNonNullExpression" ||
    type === "TSTypeAssertion" ||
    type === "TSInstantiationExpression"
  );
}

// biome-ignore lint/suspicious/noExplicitAny: `finishNode` isn't in acorn's published Parser type; svelte's own acorn.js subclasses the same way
const nodeTrackingPlugin = ((BaseParser: any) =>
  class extends BaseParser {
    finishNode(node: AcornNode, type: string) {
      if (type === "ParenthesizedExpression") parenTracking.sawParenthesized = true;
      else if (type.charCodeAt(0) === 84 /* T */ && isTypeCastWrapperType(type)) typeCastWrapperNodes.count++;
      return super.finishNode(node, type);
    }
  }) as unknown as (BaseParser: typeof Parser) => typeof Parser;

const JSParser = Parser.extend(nodeTrackingPlugin);
const TSParser = Parser.extend(tsPlugin(), nodeTrackingPlugin);

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
const TS_EXPRESSION_OPTIONS = { ...EXPRESSION_OPTIONS, startLocation: null as StartLocation | null };
const TS_STATEMENT_OPTIONS = { ...STATEMENT_OPTIONS, startLocation: null as StartLocation | null };

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
  // `(`) produce no `ParenthesizedExpression`; skip zimmerframe's tree walk
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
  lineTable?: LineTable,
) {
  const commentsBefore = comments.length;
  const ParserClass = parserFor(isTypeScript);
  bindOnComment(source, comments);
  // Constructing a raw Parser to call unexported parseStatement isn't in
  // acorn's public types. svelte's own acorn.js does the same cast.
  let options = STATEMENT_OPTIONS;
  if (isTypeScript) {
    TS_STATEMENT_OPTIONS.startLocation = startLocationFor(source, index, lineTable);
    options = TS_STATEMENT_OPTIONS;
  }
  // biome-ignore lint/suspicious/noExplicitAny: see comment above
  const parser = new (ParserClass as any)(options, source, index);
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
