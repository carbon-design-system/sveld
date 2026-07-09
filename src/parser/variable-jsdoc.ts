import { parse as parseComment } from "comment-parser";
import type ComponentParser from "../ComponentParser";
import type { ParserContext } from "./context";
import { getCommentTags } from "./jsdoc";

interface ScriptComment {
  /** Offset (into the full component source) right after the closing delimiter. */
  end: number;
  isJsDoc: boolean;
  /** Raw comment text, delimiters included. */
  text: string;
}

interface TopLevelDeclaration {
  name: string;
  /** Offset of the declaration's (or, for `export`, the export statement's) first token. */
  start: number;
}

const WHITESPACE_ONLY_REGEX = /^\s*$/;

function skipStringLiteral(source: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return i;
}

/** Skips a template literal, including nested `${...}` expressions (which may themselves nest strings/templates). */
function skipTemplateLiteral(source: string, start: number): number {
  let i = start + 1;
  let exprDepth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (exprDepth === 0) {
      if (ch === "`") return i + 1;
      if (ch === "$" && source[i + 1] === "{") {
        exprDepth = 1;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (ch === "{") {
      exprDepth++;
    } else if (ch === "}") {
      exprDepth--;
    } else if (ch === '"' || ch === "'") {
      i = skipStringLiteral(source, i, ch);
      continue;
    } else if (ch === "`") {
      i = skipTemplateLiteral(source, i);
      continue;
    }
    i++;
  }
  return i;
}

/**
 * Finds every `//` and `/* *\/` comment in `scriptSource`, skipping string and template
 * literal contents so declaration-like or comment-like text inside them can't be mistaken
 * for the real thing. `offsetBase` maps positions back into the full component source,
 * since `scriptSource` is a slice starting there.
 */
function buildCommentIndex(scriptSource: string, offsetBase: number): ScriptComment[] {
  const comments: ScriptComment[] = [];
  const len = scriptSource.length;
  let i = 0;

  while (i < len) {
    const ch = scriptSource[i];

    if (ch === '"' || ch === "'") {
      i = skipStringLiteral(scriptSource, i, ch);
      continue;
    }
    if (ch === "`") {
      i = skipTemplateLiteral(scriptSource, i);
      continue;
    }
    if (ch === "/" && scriptSource[i + 1] === "/") {
      let j = i + 2;
      while (j < len && scriptSource[j] !== "\n") j++;
      i = j;
      continue;
    }
    if (ch === "/" && scriptSource[i + 1] === "*") {
      const start = i;
      let j = i + 2;
      while (j < len && !(scriptSource[j] === "*" && scriptSource[j + 1] === "/")) j++;
      const end = Math.min(j + 2, len);
      const text = scriptSource.slice(start, end);
      comments.push({ end: end + offsetBase, isJsDoc: text.startsWith("/**") && text.length > 4, text });
      i = end;
      continue;
    }
    i++;
  }

  return comments;
}

function addDeclarationNames(node: unknown, start: number, declarations: TopLevelDeclaration[]): void {
  if (!node || typeof node !== "object" || !("type" in node)) return;
  const decl = node as {
    type: string;
    id?: { type?: string; name?: string };
    declarations?: Array<{ id?: { type?: string; name?: string } }>;
  };

  if (decl.type === "FunctionDeclaration") {
    if (decl.id?.type === "Identifier" && decl.id.name) {
      declarations.push({ name: decl.id.name, start });
    }
    return;
  }

  if (decl.type === "VariableDeclaration") {
    for (const declarator of decl.declarations ?? []) {
      if (declarator?.id?.type === "Identifier" && declarator.id.name) {
        declarations.push({ name: declarator.id.name, start });
      }
    }
  }
}

/** Every top-level `const`/`let`/`function` (including `export`-ed ones) in a script's Program body. */
function collectTopLevelDeclarations(body: unknown[]): TopLevelDeclaration[] {
  const declarations: TopLevelDeclaration[] = [];

  for (const statement of body) {
    if (!statement || typeof statement !== "object" || !("type" in statement)) continue;
    const stmt = statement as { type: string; start?: number; declaration?: unknown };
    if (stmt.start === undefined) continue;

    if (stmt.type === "ExportNamedDeclaration" && stmt.declaration) {
      addDeclarationNames(stmt.declaration, stmt.start, declarations);
    } else {
      addDeclarationNames(stmt, stmt.start, declarations);
    }
  }

  return declarations;
}

/** The closest JSDoc block comment with only whitespace between its end and `declStart`, if any. */
function findAttachedComment(comments: ScriptComment[], declStart: number, source: string): ScriptComment | undefined {
  let attached: ScriptComment | undefined;

  for (const comment of comments) {
    if (comment.end > declStart) break;
    if (!comment.isJsDoc) continue;
    if (!WHITESPACE_ONLY_REGEX.test(source.slice(comment.end, declStart))) continue;
    attached = comment;
  }

  return attached;
}

/**
 * Maps every top-level variable/function name declared in a component's module and instance
 * scripts to the `@type`/description from its attached JSDoc block. Used by
 * {@link ComponentParser.findVariableTypeAndDescription} to resolve plain identifiers (e.g. a
 * value passed to `setContext`) that aren't otherwise typed by a prop or a TS annotation.
 */
export function buildVariableJsDocTable(
  ctx: ParserContext,
  parser: ComponentParser,
): Map<string, { type: string; description?: string }> {
  const table = new Map<string, { type: string; description?: string }>();
  if (!ctx.source) return table;

  const scripts = [ctx.parsed?.module, ctx.parsed?.instance] as unknown as Array<
    { content?: { start?: number; end?: number; body?: unknown[] } } | undefined
  >;

  const allComments: ScriptComment[] = [];
  const allDeclarations: TopLevelDeclaration[] = [];

  for (const script of scripts) {
    const program = script?.content;
    if (!program?.body || program.start === undefined || program.end === undefined) continue;

    allComments.push(...buildCommentIndex(ctx.source.slice(program.start, program.end), program.start));
    allDeclarations.push(...collectTopLevelDeclarations(program.body));
  }

  allComments.sort((a, b) => a.end - b.end);

  for (const declaration of allDeclarations) {
    const comment = findAttachedComment(allComments, declaration.start, ctx.source);
    if (!comment) continue;

    const parsed = parseComment(comment.text, { spacing: "preserve" });
    const { type: typeTag, description } = getCommentTags(parsed);
    if (!typeTag) continue;

    table.set(declaration.name, {
      type: parser.aliasType(typeTag.type),
      description: description || typeTag.description,
    });
  }

  return table;
}
