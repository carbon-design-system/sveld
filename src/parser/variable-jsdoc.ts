import type ComponentParser from "../ComponentParser";
import type { CommentWithLocation } from "../template-parse/comments";
import type { ParserContext } from "./context";
import { recordSveldIgnore } from "./diagnostics";
import { getCommentTags, isJsDocGap, parseCommentText, typeTagDescription } from "./jsdoc";

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

/**
 * Every `/* *\/` comment inside `[programStart, programEnd)`, taken from the
 * comments acorn already collected while parsing the script (which skips
 * string, template, and regex literal contents correctly), so the script
 * source isn't rescanned for them here.
 */
function collectBlockComments(
  comments: CommentWithLocation[],
  source: string,
  programStart: number,
  programEnd: number,
  into: ScriptComment[],
): void {
  for (const comment of comments) {
    if (comment.type !== "Block" || comment.start < programStart || comment.end > programEnd) continue;
    const text = source.slice(comment.start, comment.end);
    into.push({ end: comment.end, isJsDoc: text.startsWith("/**") && text.length > 4, text });
  }
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

/** The closest JSDoc block comment with only whitespace or other comments between it and `declStart`, if any. */
function findAttachedComment(comments: ScriptComment[], declStart: number, source: string): ScriptComment | undefined {
  let attached: ScriptComment | undefined;

  for (const comment of comments) {
    if (comment.end > declStart) break;
    if (!comment.isJsDoc) continue;
    if (!isJsDocGap(source, comment.end, declStart)) continue;
    attached = comment;
  }

  return attached;
}

/**
 * Maps every top-level variable/function name declared in a component's module and instance
 * scripts to the `@type`/description from its attached JSDoc block. Used by
 * {@link ComponentParser.findVariableTypeAndDescription} to resolve plain identifiers (e.g. a
 * value passed to `setContext`) that aren't otherwise typed by a prop or a TS annotation. A block
 * without `@type` still records its description and `@internal`, for a TS-annotated variable.
 */
export function buildVariableJsDocTable(
  ctx: ParserContext,
  parser: ComponentParser,
): Map<string, { type?: string; description?: string; internal?: boolean }> {
  const table = new Map<string, { type?: string; description?: string; internal?: boolean }>();
  if (!ctx.source) return table;

  const scripts = [ctx.parsed?.module, ctx.parsed?.instance] as unknown as Array<
    { content?: { start?: number; end?: number; body?: unknown[] } } | undefined
  >;

  const allComments: ScriptComment[] = [];
  const allDeclarations: TopLevelDeclaration[] = [];
  const comments = (ctx.parsed as unknown as { comments?: CommentWithLocation[] } | undefined)?.comments ?? [];

  for (const script of scripts) {
    const program = script?.content;
    if (!program?.body || program.start === undefined || program.end === undefined) continue;

    collectBlockComments(comments, ctx.source, program.start, program.end, allComments);
    allDeclarations.push(...collectTopLevelDeclarations(program.body));
  }

  allComments.sort((a, b) => a.end - b.end);

  for (const declaration of allDeclarations) {
    const comment = findAttachedComment(allComments, declaration.start, ctx.source);
    if (!comment) continue;

    const parsed = parseCommentText(ctx, comment.text);
    const { type: typeTag, description, ignore: ignoreCodes, internal } = getCommentTags(parsed);
    if (ignoreCodes.length > 0) {
      recordSveldIgnore(ctx, "context-any-type", declaration.name, ignoreCodes);
    }
    if (!typeTag && !description && !internal) continue;

    table.set(declaration.name, {
      type: typeTag ? parser.aliasType(typeTag.type) : undefined,
      description: description || (typeTag && typeTagDescription(typeTag)),
      internal: internal || undefined,
    });
  }

  return table;
}
