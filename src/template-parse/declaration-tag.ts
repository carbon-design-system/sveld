import type { VariableDeclaration } from "estree";
import { parseStatementAt } from "./acorn-bridge";
import type { TemplateParserState } from "./state";

const REGEX_SUPPORTED_DECLARATION = /(?:let|const)\b/y;
const REGEX_UNSUPPORTED_DECLARATION = /(?:var|interface|enum)\b/y;
// `type` is a contextual keyword. `{type}` (a variable) is as valid as
// `{type X = Y}` (a declaration). This regex is a hint; the speculative
// statement parse below decides.
const REGEX_MAYBE_TYPE_DECLARATION = /type\b/y;

/**
 * Bare `{let x = 1}` / `{const x = 1}`, distinct from `{@const}`. From svelte's
 * `read_declaration` in `state/tag.js`. Returns `null` with the cursor
 * untouched when this isn't a declaration, e.g. `{type}` referring to a prop.
 */
export function readDeclarationTag(state: TemplateParserState): VariableDeclaration | null {
  const start = state.index;

  if (state.matchRegex(REGEX_UNSUPPORTED_DECLARATION)) {
    throw new Error("sveld: `var`/`interface`/`enum` are not valid here");
  }

  if (!state.matchRegex(REGEX_SUPPORTED_DECLARATION) && !state.matchRegex(REGEX_MAYBE_TYPE_DECLARATION)) {
    return null;
  }

  const commentsBefore = state.root.comments.length;
  const statement = parseStatementAt(state.source, start, state.isTypeScript, state.root.comments) as unknown as {
    type: string;
    kind?: string;
    end: number;
  };

  if (statement.type !== "VariableDeclaration") {
    if (statement.type === "ExpressionStatement") {
      // Not a declaration after all, e.g. `{type}`. Drop comments this
      // speculative parse collected so the real expression parse doesn't
      // duplicate them.
      state.root.comments.length = commentsBefore;
      return null;
    }
    throw new Error("sveld: expected a `let`/`const` declaration");
  }

  if (statement.kind !== "let" && statement.kind !== "const") {
    throw new Error("sveld: expected a `let`/`const` declaration");
  }

  state.index = statement.end;
  state.allowWhitespace();
  state.eat("}", true);

  return statement as unknown as VariableDeclaration;
}
