import type { AST } from "svelte/compiler";
import { closeBlock, nextBlockClause, openBlock } from "./blocks";
import { readDeclarationTag } from "./declaration-tag";
import { readExpression } from "./expression";
import { readSpecialTag } from "./special-tags";
import type { TemplateParserState } from "./state";

/** From svelte's `tag()` dispatch (`state/tag.js`). */
export function readTag(state: TemplateParserState): void {
  const start = state.index;
  state.index += 1;
  state.allowWhitespace();

  if (state.eat("#")) {
    openBlock(state);
    return;
  }
  if (state.eat(":")) {
    nextBlockClause(state);
    return;
  }
  if (state.eat("@")) {
    readSpecialTag(state);
    return;
  }
  if (state.match("/") && !state.match("/*") && !state.match("//")) {
    state.eat("/");
    closeBlock(state);
    return;
  }

  const declaration = readDeclarationTag(state);
  if (declaration) {
    const node: AST.DeclarationTag = { type: "DeclarationTag", start, end: state.index, declaration };
    state.append(node);
    return;
  }

  const expression = readExpression(state);
  state.allowWhitespace();
  state.eat("}", true);

  const node: AST.ExpressionTag = { type: "ExpressionTag", start, end: state.index, expression };
  state.append(node);
}
