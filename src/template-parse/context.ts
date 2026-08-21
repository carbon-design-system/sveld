import type { Pattern } from "estree";
import { parseExpressionAt } from "./acorn-bridge";
import { matchBracket } from "./bracket";
import type { TemplateParserState } from "./state";

const REGEX_NOT_NEWLINE = /[^\n]/g;
const REGEX_OPTIONAL_PARAM_COLON = /\?\s*:/g;

/**
 * Binding target: a bare identifier or a destructuring pattern, each possibly
 * with a `: Type` annotation. Used by `{#each x as pattern}`, `{:then}`,
 * `{:catch}`, and `{@const}`. From svelte's `read/context.js`.
 *
 * Destructuring is sliced out as raw `{...}`/`[...]` text and reparsed as
 * `(pattern = 1)` so acorn treats it as an assignment pattern, not a block.
 * The source is space-padded so offsets land on the real positions.
 */
export function readPattern(state: TemplateParserState): Pattern {
  const start = state.index;
  const id = state.readIdentifierName();

  if (id.name !== "") {
    const typeAnnotation = readTypeAnnotation(state);
    return { ...id, typeAnnotation } as unknown as Pattern;
  }

  const char = state.source[state.index];
  if (char !== "{" && char !== "[") {
    throw new Error("sveld: expected a binding pattern");
  }

  const end = matchBracket(state, start);
  state.index = end;
  const patternString = state.source.slice(start, end);

  let spaceWithNewline = state.source.slice(0, start).replace(REGEX_NOT_NEWLINE, " ");
  const firstSpace = spaceWithNewline.indexOf(" ");
  spaceWithNewline = spaceWithNewline.slice(0, firstSpace) + spaceWithNewline.slice(firstSpace + 1);

  const synthetic = `${spaceWithNewline}(${patternString} = 1)`;
  const { node } = parseExpressionAt(synthetic, start - 1, state.isTypeScript, state.root.comments);
  const pattern = (node as unknown as { left: Pattern }).left;

  const typeAnnotation = readTypeAnnotation(state);
  if (typeAnnotation) {
    (pattern as unknown as { typeAnnotation: unknown; end: number }).typeAnnotation = typeAnnotation;
    (pattern as unknown as { end: number }).end = typeAnnotation.end;
  }

  return pattern;
}

interface TypeAnnotationNode {
  type: "TSTypeAnnotation";
  start: number;
  end: number;
  typeAnnotation: unknown;
}

function readTypeAnnotation(state: TemplateParserState): TypeAnnotationNode | undefined {
  const start = state.index;
  state.allowWhitespace();

  if (!state.eat(":")) {
    state.index = start;
    return undefined;
  }

  const insert = "_ as ";
  const a = state.index - insert.length;
  const synthetic =
    state.source.slice(0, a).replace(REGEX_NOT_NEWLINE, " ") +
    insert +
    state.source.slice(state.index).replace(REGEX_OPTIONAL_PARAM_COLON, ":");

  let { node } = parseExpressionAt(synthetic, a, state.isTypeScript, state.root.comments);
  let expression = node as unknown as {
    type: string;
    end: number;
    right?: { start: number };
    expressions?: unknown[];
    typeAnnotation?: unknown;
  };

  if (expression.type === "AssignmentExpression") {
    let b = (expression.right as { start: number }).start;
    while (synthetic[b] !== "=") b -= 1;
    ({ node } = parseExpressionAt(synthetic.slice(0, b), a, state.isTypeScript, state.root.comments));
    expression = node as typeof expression;
  }

  if (expression.type === "SequenceExpression" && expression.expressions) {
    expression = expression.expressions[0] as typeof expression;
  }

  state.index = expression.end;
  return { type: "TSTypeAnnotation", start, end: state.index, typeAnnotation: expression.typeAnnotation };
}
