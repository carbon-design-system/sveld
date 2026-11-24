import type { AST, Program } from "svelte-ast";
import { getPropByLocalOrPublic, type ParserContext } from "./context";
import { recordSveldIgnore } from "./diagnostics";
import { aliasType, getCommentTags, isJsDocGap, parseCommentText, processNodeJSDoc, typeTagDescription } from "./jsdoc";
import { trackAdditionalTypeDependencyNode } from "./type-resolution";

interface ScriptComment {
  /** Offsets into the full component source, delimiters included. */
  start: number;
  end: number;
  isJsDoc: boolean;
}

interface TopLevelDeclaration {
  name: string;
  /**
   * Offset of the declaration's (or, for `export`, the export statement's)
   * first token.
   */
  start: number;
}

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

// `comments` must be sorted by `end`. Only the closest JSDoc block can
// attach, since any before it has that block in its gap.
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

// A block without `@type` is still recorded, since a TS-annotated
// variable still uses its docs.
function buildVariableJsDocTable(ctx: ParserContext): NonNullable<ParserContext["variableInfoCache"]> {
  const table: NonNullable<ParserContext["variableInfoCache"]> = new Map();
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

function variableJsDocEntry(ctx: ParserContext, varName: string) {
  ctx.variableInfoCache ??= buildVariableJsDocTable(ctx);
  return ctx.variableInfoCache.get(varName);
}

export function findVariableTypeAndDescription(
  ctx: ParserContext,
  varName: string,
): { type: string; description?: string; internal?: boolean } | null {
  const prop = getPropByLocalOrPublic(ctx, varName);
  if (prop?.type) return { type: prop.type, description: prop.description, internal: prop.internal };

  const cached = variableJsDocEntry(ctx, varName);

  const explicitType = ctx.explicitVariableTypesByName.get(varName);
  if (explicitType) return { type: explicitType, description: cached?.description, internal: cached?.internal };

  // A JSDoc block without `@type` only types a TS-annotated
  // variable (above).
  if (!cached?.type) return null;
  return { type: cached.type, description: cached.description, internal: cached.internal };
}

// For a type that ends up in generated output (a context, an event
// detail), so its TS annotation's dependencies reach the `.d.ts`.
export function findTrackedVariableType(ctx: ParserContext, name: string) {
  const varInfo = findVariableTypeAndDescription(ctx, name);
  if (varInfo && varInfo.type === ctx.explicitVariableTypesByName.get(name)) {
    trackAdditionalTypeDependencyNode(ctx, ctx.explicitVariableTypeNodesByName.get(name));
  }
  return varInfo;
}

export function findVariableJsDoc(ctx: ParserContext, varName: string): { description?: string; internal?: boolean } {
  const cached = variableJsDocEntry(ctx, varName);
  return {
    ...(cached?.description ? { description: cached.description } : {}),
    ...(cached?.internal ? { internal: true } : {}),
  };
}

export function resolveLocalVarJSDoc(ctx: ParserContext, name: string) {
  for (const decl of ctx.vars) {
    if (decl.declarations.some((declarator) => declarator.id.type === "Identifier" && declarator.id.name === name)) {
      return declarationJSDoc(ctx, decl);
    }
  }
  const funcDecl = ctx.funcDecls.get(name);
  return funcDecl && declarationJSDoc(ctx, funcDecl);
}

// When exported, the JSDoc sits on the `export` statement instead of
// the declaration.
function declarationJSDoc(ctx: ParserContext, declaration: object) {
  const own = processNodeJSDoc(ctx, declaration);
  if (own) return own;
  for (const script of [ctx.parsed?.instance, ctx.parsed?.module]) {
    for (const statement of script?.content.body ?? []) {
      if (statement.type === "ExportNamedDeclaration" && statement.declaration === declaration) {
        return processNodeJSDoc(ctx, statement);
      }
    }
  }
  return undefined;
}
