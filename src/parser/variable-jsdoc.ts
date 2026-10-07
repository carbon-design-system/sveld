import type { AST, Program } from "sveast";
import { getPropByLocalOrPublic, type ParserContext } from "./context";
import { recordSveldIgnore } from "./diagnostics";
import { aliasType, getCommentTags, isJsDocGap, parseCommentText, processNodeJSDoc, typeTagDescription } from "./jsdoc";

interface ScriptComment {
  /** Offsets into the full component source, delimiters included. */
  start: number;
  end: number;
  isJsDoc: boolean;
}

interface TopLevelDeclaration {
  name: string;
  /** Offset of the declaration's (or, for `export`, the export statement's) first token. */
  start: number;
}

/** Every `/* *\/` comment sveast collected inside `[programStart, programEnd)`. */
function collectBlockComments(
  comments: AST.JSComment[],
  source: string,
  programStart: number,
  programEnd: number,
  into: ScriptComment[],
): void {
  for (const comment of comments) {
    if (comment.type !== "Block" || comment.start < programStart || comment.end > programEnd) continue;
    into.push({
      start: comment.start,
      end: comment.end,
      isJsDoc: comment.end - comment.start > 4 && source.startsWith("/**", comment.start),
    });
  }
}

/** Every top-level `const`/`let`/`function` (`export`-ed ones included) in a script's body. */
function collectTopLevelDeclarations(body: Program["body"], into: TopLevelDeclaration[]): void {
  for (const statement of body) {
    const { start } = statement;
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "FunctionDeclaration") {
      if (declaration.id?.name) into.push({ name: declaration.id.name, start });
    } else if (declaration?.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === "Identifier" && declarator.id.name) into.push({ name: declarator.id.name, start });
      }
    }
  }
}

/**
 * The closest JSDoc block comment with only whitespace or other comments
 * between it and `declStart`, if any. `comments` is sorted by `end`. Any
 * JSDoc block before the closest one has that block in its gap, so only
 * the closest can attach.
 */
function findAttachedComment(comments: ScriptComment[], declStart: number, source: string): ScriptComment | undefined {
  let low = 0;
  let high = comments.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (comments[mid].end <= declStart) low = mid + 1;
    else high = mid;
  }

  for (let index = low - 1; index >= 0; index--) {
    const comment = comments[index];
    if (!comment.isJsDoc) continue;
    return isJsDocGap(source, comment.end, declStart) ? comment : undefined;
  }
  return undefined;
}

/**
 * Maps each top-level variable/function name in the module and instance scripts to the
 * `@type`/description/`@internal` of its attached JSDoc block. A block without `@type` is
 * still recorded, for a TS-annotated variable.
 */
function buildVariableJsDocTable(
  ctx: ParserContext,
): Map<string, { type?: string; description?: string; internal?: boolean }> {
  const table = new Map<string, { type?: string; description?: string; internal?: boolean }>();
  if (!ctx.source) return table;

  const allComments: ScriptComment[] = [];
  const allDeclarations: TopLevelDeclaration[] = [];
  const comments = ctx.parsed?.comments ?? [];

  for (const script of [ctx.parsed?.module, ctx.parsed?.instance]) {
    const program = script?.content;
    if (!program) continue;

    collectBlockComments(comments, ctx.source, program.start, program.end, allComments);
    collectTopLevelDeclarations(program.body, allDeclarations);
  }

  allComments.sort((a, b) => a.end - b.end);

  for (const declaration of allDeclarations) {
    const comment = findAttachedComment(allComments, declaration.start, ctx.source);
    if (!comment) continue;

    const parsed = parseCommentText(ctx, ctx.source.slice(comment.start, comment.end));
    const { type: typeTag, description, ignore: ignoreCodes, internal } = getCommentTags(parsed);
    if (ignoreCodes.length > 0) recordSveldIgnore(ctx, "context-any-type", declaration.name, ignoreCodes);
    if (!typeTag && !description && !internal) continue;

    table.set(declaration.name, {
      type: typeTag ? aliasType(typeTag.type) : undefined,
      description: description || (typeTag && typeTagDescription(typeTag)),
      internal: internal || undefined,
    });
  }

  return table;
}

/** The JSDoc table entry for `varName`, building the table on first use. */
function variableJsDocEntry(ctx: ParserContext, varName: string) {
  if (!ctx.variableInfoCacheBuilt) {
    ctx.variableInfoCache = buildVariableJsDocTable(ctx);
    ctx.variableInfoCacheBuilt = true;
  }
  return ctx.variableInfoCache.get(varName);
}

/** The type and docs of `varName`: from a prop, a TS annotation, or a JSDoc `@type`. */
export function findVariableTypeAndDescription(
  ctx: ParserContext,
  varName: string,
): { type: string; description?: string; internal?: boolean } | null {
  const prop = getPropByLocalOrPublic(ctx, varName);
  if (prop?.type) return { type: prop.type, description: prop.description, internal: prop.internal };

  const cached = variableJsDocEntry(ctx, varName);

  const explicitType = ctx.explicitVariableTypesByName.get(varName);
  if (explicitType) return { type: explicitType, description: cached?.description, internal: cached?.internal };

  // A JSDoc block without `@type` only types a TS-annotated variable (above).
  if (!cached?.type) return null;
  return { type: cached.type, description: cached.description, internal: cached.internal };
}

/** The description and `@internal` flag of the JSDoc above `varName`, with or without `@type`. */
export function findVariableJsDoc(ctx: ParserContext, varName: string): { description?: string; internal?: boolean } {
  const cached = variableJsDocEntry(ctx, varName);
  return {
    ...(cached?.description ? { description: cached.description } : {}),
    ...(cached?.internal ? { internal: true } : {}),
  };
}

/** The JSDoc on the local variable or function declaration named `name`. */
export function resolveLocalVarJSDoc(ctx: ParserContext, name: string) {
  for (const decl of ctx.vars) {
    if (decl.declarations.some((declarator) => declarator.id.type === "Identifier" && declarator.id.name === name)) {
      return processNodeJSDoc(ctx, decl);
    }
  }
  return processNodeJSDoc(ctx, ctx.funcDecls.get(name));
}
