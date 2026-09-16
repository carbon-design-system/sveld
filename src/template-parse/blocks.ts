import type { Pattern } from "estree";
import type { AST } from "svelte/compiler";
import { matchBracket } from "./bracket";
import { readPattern } from "./context";
import { readExpression } from "./expression";
import { createFragment, type Fragment } from "./reader";
import type { StackNode, TemplateParserState } from "./state";

const REGEX_WHITESPACE_THEN_CLOSING_BRACE = /\s*}/y;
const REGEX_GENERIC_BRACKETS: Record<string, string> = { "<": ">" };

/**
 * `{#if}` / `{#each}` / `{#await}` / `{#key}` / `{#snippet}` openers. From
 * svelte's `open()` in `state/tag.js`. Ambiguous-grammar recovery that
 * unswallows a `then`/`catch`/`as` eaten by the expression is not ported.
 */
export function openBlock(state: TemplateParserState): void {
  let start = state.index - 2;
  while (state.source[start] !== "{") start -= 1;

  if (state.eat("if")) {
    state.requireWhitespace();
    const block: AST.IfBlock = {
      type: "IfBlock",
      elseif: false,
      start,
      end: -1,
      test: readExpression(state),
      consequent: createFragment(),
      alternate: null,
    };
    state.append(block);
    state.allowWhitespace();
    state.eat("}", true);
    state.push(block as unknown as StackNode, block.consequent);
    return;
  }

  if (state.eat("each")) {
    state.requireWhitespace();
    let expression = readExpression(state);
    state.allowWhitespace();

    // In TypeScript, `{#each rows as row}` parses `rows as row` as a
    // TSAsExpression, and `{#each rows as row, index}` as a SequenceExpression
    // of that plus `index`. If the next token isn't `as`, unwrap a top-level
    // TSAsExpression and rewind to the `as` so the each-context parse below
    // can read it. Nested cases like `a + (b as Foo)` are left alone.
    if (!state.match("as")) {
      let candidate = expression as unknown as { type: string; expressions?: unknown[] };
      if (candidate.type === "SequenceExpression" && candidate.expressions) {
        candidate = candidate.expressions[0] as typeof candidate;
      }

      if (candidate.type === "TSAsExpression") {
        const assertion = candidate as unknown as { expression: typeof expression; typeAnnotation: { start: number } };
        expression = assertion.expression;
        let rewind = assertion.typeAnnotation.start - 2;
        while (rewind >= 0 && !(state.source[rewind] === "a" && state.source[rewind + 1] === "s")) rewind -= 1;
        state.index = rewind;
      }
    }

    let context: Pattern | null = null;
    let index: string | undefined;
    let key: unknown;

    if (state.eat("as")) {
      state.requireWhitespace();
      context = readPattern(state);
    }

    state.allowWhitespace();

    if (state.eat(",")) {
      state.allowWhitespace();
      const id = state.readIdentifierName();
      if (!id.name) throw new Error("sveld: expected an identifier");
      index = id.name;
      state.allowWhitespace();
    }

    if (state.eat("(")) {
      state.allowWhitespace();
      key = readExpression(state);
      state.allowWhitespace();
      state.eat(")", true);
      state.allowWhitespace();
    }

    state.eat("}", true);

    const block: AST.EachBlock = {
      type: "EachBlock",
      start,
      end: -1,
      expression,
      body: createFragment(),
      context,
      index,
      key: key as AST.EachBlock["key"],
    };
    state.append(block);
    state.push(block as unknown as StackNode, block.body);
    return;
  }

  if (state.eat("await")) {
    state.requireWhitespace();
    const expression = readExpression(state);
    state.allowWhitespace();

    const block: AST.AwaitBlock = {
      type: "AwaitBlock",
      start,
      end: -1,
      expression,
      value: null,
      error: null,
      pending: null,
      // biome-ignore lint/suspicious/noThenProperty: svelte's own AwaitBlock field name
      then: null,
      catch: null,
    };

    if (state.eat("then")) {
      if (!state.matchRegex(REGEX_WHITESPACE_THEN_CLOSING_BRACE)) {
        state.requireWhitespace();
        block.value = readPattern(state);
        state.allowWhitespace();
      }
      // biome-ignore lint/suspicious/noThenProperty: svelte's own AwaitBlock field name
      block.then = createFragment();
    } else if (state.eat("catch")) {
      if (!state.matchRegex(REGEX_WHITESPACE_THEN_CLOSING_BRACE)) {
        state.requireWhitespace();
        block.error = readPattern(state);
        state.allowWhitespace();
      }
      block.catch = createFragment();
    } else {
      block.pending = createFragment();
    }

    state.eat("}", true);
    state.append(block);
    state.push(block as unknown as StackNode, (block.then ?? block.catch ?? block.pending) as Fragment);
    return;
  }

  if (state.eat("key")) {
    state.requireWhitespace();
    const expression = readExpression(state);
    state.allowWhitespace();
    state.eat("}", true);

    const block: AST.KeyBlock = { type: "KeyBlock", start, end: -1, expression, fragment: createFragment() };
    state.append(block);
    state.push(block as unknown as StackNode, block.fragment);
    return;
  }

  if (state.eat("snippet")) {
    state.requireWhitespace();
    const id = state.readIdentifierName();
    if (id.name === "") throw new Error("sveld: expected a snippet name");
    state.allowWhitespace();

    let typeParams: string | undefined;

    if (state.isTypeScript && state.match("<")) {
      const genericsStart = state.index;
      const end = matchBracket(state, genericsStart, REGEX_GENERIC_BRACKETS);
      typeParams = state.source.slice(genericsStart + 1, end - 1);
      state.index = end;
    }

    state.allowWhitespace();

    // Scan past `(...)` to the body. `SnippetBlock.parameters` is never read,
    // so skip the synthetic `(prelude+params) => {}` acorn parse svelte uses
    // to extract it.
    if (state.eat("(")) {
      let parentheses = 1;
      while (state.index < state.source.length && (!state.match(")") || parentheses !== 1)) {
        if (state.match("(")) parentheses++;
        if (state.match(")")) parentheses--;
        state.index += 1;
      }
      state.eat(")", true);
    }

    state.allowWhitespace();
    state.eat("}", true);

    const block: AST.SnippetBlock = {
      type: "SnippetBlock",
      start,
      end: -1,
      expression: id as unknown as AST.SnippetBlock["expression"],
      typeParams,
      parameters: [],
      body: createFragment(),
    };
    state.append(block);
    state.push(block as unknown as StackNode, block.body);
    return;
  }

  throw new Error("sveld: expected if/each/await/key/snippet");
}

/** `{:else}` / `{:else if}` / `{:then}` / `{:catch}`. From svelte's `next()`. */
export function nextBlockClause(state: TemplateParserState): void {
  const start = state.index - 1;
  const block = state.current() as unknown as AST.IfBlock | AST.EachBlock | AST.AwaitBlock;

  if (block.type === "IfBlock") {
    if (!state.eat("else")) throw new Error("sveld: expected {:else} or {:else if}");
    if (state.eat("if")) throw new Error("sveld: {:else if} cannot follow {:else if} directly");

    state.allowWhitespace();
    state.fragments.pop();
    block.alternate = createFragment();
    state.fragments.push(block.alternate);

    if (state.eat("if")) {
      state.requireWhitespace();
      const expression = readExpression(state);
      state.allowWhitespace();
      state.eat("}", true);

      let elseifStart = start - 1;
      while (state.source[elseifStart] !== "{") elseifStart -= 1;

      const child: AST.IfBlock = {
        type: "IfBlock",
        start: elseifStart,
        end: -1,
        elseif: true,
        test: expression,
        consequent: createFragment(),
        alternate: null,
      };
      state.append(child);
      state.stack.push(child as unknown as StackNode);
      state.fragments.pop();
      state.fragments.push(child.consequent);
    } else {
      state.allowWhitespace();
      state.eat("}", true);
    }
    return;
  }

  if (block.type === "EachBlock") {
    if (!state.eat("else")) throw new Error("sveld: expected {:else}");
    state.allowWhitespace();
    state.eat("}", true);

    block.fallback = createFragment();
    state.fragments.pop();
    state.fragments.push(block.fallback);
    return;
  }

  if (block.type === "AwaitBlock") {
    if (state.eat("then")) {
      if (block.then) throw new Error("sveld: duplicate {:then}");
      if (!state.eat("}")) {
        state.requireWhitespace();
        block.value = readPattern(state);
        state.allowWhitespace();
        state.eat("}", true);
      }
      // biome-ignore lint/suspicious/noThenProperty: svelte's own AwaitBlock field name
      block.then = createFragment();
      state.fragments.pop();
      state.fragments.push(block.then);
      return;
    }

    if (state.eat("catch")) {
      if (block.catch) throw new Error("sveld: duplicate {:catch}");
      if (!state.eat("}")) {
        state.requireWhitespace();
        block.error = readPattern(state);
        state.allowWhitespace();
        state.eat("}", true);
      }
      block.catch = createFragment();
      state.fragments.pop();
      state.fragments.push(block.catch);
      return;
    }

    throw new Error("sveld: expected {:then ...} or {:catch ...}");
  }

  throw new Error("sveld: {:...} not valid here");
}

/** `{/if}` / `{/each}` / `{/await}` / `{/key}` / `{/snippet}`. From svelte's `close()`. */
type ClosableBlock = (AST.IfBlock | AST.EachBlock | AST.KeyBlock | AST.AwaitBlock | AST.SnippetBlock) & StackNode;

export function closeBlock(state: TemplateParserState): void {
  let block = state.current() as unknown as ClosableBlock;

  switch (block.type) {
    case "IfBlock": {
      state.eat("if", true);
      state.allowWhitespace();
      state.eat("}", true);

      while (block.type === "IfBlock" && block.elseif) {
        block.end = state.index;
        state.stack.pop();
        block = state.current() as unknown as ClosableBlock;
      }

      block.end = state.index;
      state.pop();
      return;
    }
    case "EachBlock":
      state.eat("each", true);
      break;
    case "KeyBlock":
      state.eat("key", true);
      break;
    case "AwaitBlock":
      state.eat("await", true);
      break;
    case "SnippetBlock":
      state.eat("snippet", true);
      break;
    default:
      throw new Error("sveld: unexpected closing block tag");
  }

  state.allowWhitespace();
  state.eat("}", true);
  block.end = state.index;
  state.pop();
}
