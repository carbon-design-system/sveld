import type { Identifier, SimpleCallExpression, VariableDeclarator } from "estree";
import type { AST } from "svelte/compiler";
import { readPattern } from "./context";
import { readExpression } from "./expression";
import type { TemplateParserState } from "./state";

const REGEX_WHITESPACE_THEN_CLOSING_BRACE = /\s*}/y;

/** `{@html}` / `{@debug}` / `{@const}` / `{@render}`. From svelte's `special()` in `state/tag.js`. */
export function readSpecialTag(state: TemplateParserState): void {
  let start = state.index;
  while (state.source[start] !== "{") start -= 1;

  if (state.eat("html")) {
    state.requireWhitespace();
    const expression = readExpression(state);
    state.allowWhitespace();
    state.eat("}", true);

    const node: AST.HtmlTag = { type: "HtmlTag", start, end: state.index, expression };
    state.append(node);
    return;
  }

  if (state.eat("debug")) {
    let identifiers: Identifier[];

    if (state.read(REGEX_WHITESPACE_THEN_CLOSING_BRACE)) {
      identifiers = [];
    } else {
      const expression = readExpression(state);
      identifiers =
        expression.type === "SequenceExpression"
          ? (expression.expressions as Identifier[])
          : [expression as Identifier];

      for (const node of identifiers) {
        if (node.type !== "Identifier") throw new Error("sveld: {@debug} arguments must be identifiers");
      }

      state.allowWhitespace();
      state.eat("}", true);
    }

    const node: AST.DebugTag = { type: "DebugTag", start, end: state.index, identifiers };
    state.append(node);
    return;
  }

  if (state.eat("const")) {
    state.requireWhitespace();
    const id = readPattern(state);
    state.allowWhitespace();
    state.eat("=", true);
    state.allowWhitespace();

    const init = readExpression(state);
    const declaratorEnd = state.index;
    state.allowWhitespace();
    state.eat("}", true);

    const declarator: VariableDeclarator = {
      type: "VariableDeclarator",
      id,
      init,
      start: (id as unknown as { start: number }).start,
      end: declaratorEnd,
    } as unknown as VariableDeclarator;

    const node: AST.ConstTag = {
      type: "ConstTag",
      start,
      end: state.index,
      declaration: {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [declarator],
        start: start + 2,
        end: state.index - 1,
      } as unknown as AST.ConstTag["declaration"],
    };
    state.append(node);
    return;
  }

  if (state.eat("render")) {
    state.requireWhitespace();
    const expression = readExpression(state);

    const isCall =
      expression.type === "CallExpression" ||
      (expression.type === "ChainExpression" && expression.expression.type === "CallExpression");
    if (!isCall) throw new Error("sveld: {@render ...} must be a function call");

    state.allowWhitespace();
    state.eat("}", true);

    const node: AST.RenderTag = {
      type: "RenderTag",
      start,
      end: state.index,
      expression: expression as unknown as SimpleCallExpression,
    };
    state.append(node);
    return;
  }

  throw new Error("sveld: expected html/debug/const/render");
}
