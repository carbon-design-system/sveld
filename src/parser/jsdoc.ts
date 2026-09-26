import type { Node } from "estree";
import type {
  ComponentPropBinding,
  ComponentPropParam,
  DeprecatedValue,
  JsDocPassthroughTag,
  NodeJsDoc,
} from "../model";
import type { JSDocComment, JSDocTag } from "./comment-parser";
import { leadingWhitespaceLength, parseComments, togglesCodeFence } from "./comment-parser";
import type { ParserContext } from "./context";
import { assignValueOrUndefined } from "./utils";
import { scriptBody } from "./value-imports";

const WHITESPACE_CHAR_REGEX = /\s/;

/**
 * Whether `source` from `start` to `end` may sit between a JSDoc block and
 * the declaration it documents: whitespace, or comments that aren't JSDoc,
 * such as a `// biome-ignore ...` or `/* istanbul ignore next *\/` line.
 */
export function isJsDocGap(source: string, start: number, end: number): boolean {
  let index = start;
  while (index < end) {
    const char = source[index];
    if (char === "/" && source[index + 1] === "/") {
      const lineEnd = source.indexOf("\n", index + 2);
      if (lineEnd === -1 || lineEnd >= end) return true;
      index = lineEnd + 1;
    } else if (char === "/" && source[index + 1] === "*" && source[index + 2] !== "*") {
      const close = source.indexOf("*/", index + 2);
      if (close === -1 || close + 2 > end) return false;
      index = close + 2;
    } else if (char === " " || char === "\n" || char === "\t" || char === "\r" || WHITESPACE_CHAR_REGEX.test(char)) {
      index++;
    } else {
      return false;
    }
  }
  return true;
}

const DESCRIPTION_DASH_PREFIX_REGEX = /^-\s*/;

/**
 * Joins a wrapped tag description's lines into text. Prose lines lose their indentation, a run
 * of blank lines between paragraphs becomes one blank line, and lines inside a ```` ``` ````
 * fence keep their indentation relative to the fence's opening line (blank lines included).
 */
export function joinDescriptionLines(lines: readonly string[]): string {
  const out: string[] = [];
  /** Indentation width of the open fence's opening line; undefined outside a fence. */
  let fenceIndent: number | undefined;
  let paragraphBreak = false;
  for (const line of lines) {
    const togglesFence = togglesCodeFence(line);
    if (fenceIndent !== undefined) {
      if (togglesFence) {
        out.push(line.trim());
        fenceIndent = undefined;
      } else {
        out.push(line.slice(Math.min(fenceIndent, leadingWhitespaceLength(line))).trimEnd());
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "") {
      paragraphBreak = out.length > 0;
      continue;
    }
    if (paragraphBreak) out.push("");
    paragraphBreak = false;
    out.push(trimmed);
    if (togglesFence) fenceIndent = leadingWhitespaceLength(line);
  }
  return out.join("\n").trimEnd();
}

export function cleanDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const cleaned = description.replace(DESCRIPTION_DASH_PREFIX_REGEX, "").trim();
  return cleaned === "" ? "" : cleaned;
}

/**
 * The prose after a `@type {T}` tag's type, same line or below it. Tag parsing reads its first
 * word as a name (`@type {T} Opens the modal`), so that word is joined back on.
 */
export function typeTagDescription(tag: JSDocTag): string | undefined {
  const text = tag.name ? `${tag.name} ${tag.description}` : tag.description;
  return cleanDescription(joinDescriptionLines(text.split("\n")));
}

/** Index in a tag's lines of the one holding its inline description (where a multi-line `{type}` closes). */
export function tagHeadIndex(tagLines: ReadonlyArray<{ continuesType?: true }>): number {
  let headIndex = 0;
  while (tagLines[headIndex + 1]?.continuesType) headIndex++;
  return headIndex;
}

/** `@since`, `@example`, and `@see` are kept out of prose descriptions and exposed as `tags` instead. */
export const IDE_PASSTHROUGH_TAGS = new Set(["since", "example", "see"]);

/**
 * Tags sveld gives meaning to somewhere other than `parseCustomTypes`'s own
 * switch below: `@bindable` is handled per-prop in {@link getCommentTags},
 * and `@default`/`@required` are conventional documentation tags sveld
 * doesn't act on but doesn't consider a typo either. Anything reaching the
 * `default:` case that isn't in this set or `IDE_PASSTHROUGH_TAGS` is flagged
 * as `jsdoc-unknown-tag`.
 */
export const OTHER_KNOWN_JSDOC_TAGS = new Set(["bindable", "default", "required"]);

function toPassthroughTags(tags: JSDocTag[]): JsDocPassthroughTag[] | undefined {
  return tags.length > 0 ? tags.map((tag) => ({ name: tag.tag, body: tag.text })) : undefined;
}

export function deprecatedValueFromBody(body: string): DeprecatedValue {
  const message = body.trim();
  return message === "" ? true : message;
}

function formatComment(comment: string) {
  let formatted_comment = comment;

  if (!formatted_comment.startsWith("/*")) {
    formatted_comment = `/*${formatted_comment}`;
  }

  if (!formatted_comment.endsWith("*/")) {
    formatted_comment += "*/";
  }

  return formatted_comment;
}

/**
 * A JSDoc `{type}` as TypeScript text: trimmed, with the JSDoc wildcard `*` as `any`.
 *
 * @example
 * ```ts
 * aliasType("*"); // "any"
 * aliasType(" string "); // "string"
 * ```
 */
export function aliasType(type: string): string {
  if (type === "*") return "any";
  return type.trim();
}

/**
 * `@returns`/`@return` type from raw JSDoc text (with or without `/**` delimiters).
 * Standalone so `parse-entry-exports.ts` can read sibling modules without a
 * component parser context.
 */
export function extractJsDocReturnType(commentValue: string): string | undefined {
  const comment = parseComments(formatComment(commentValue));
  const { returns: returnsTag } = getCommentTags(comment);
  return returnsTag ? aliasType(returnsTag.type) : undefined;
}

/**
 * `@deprecated`, passthrough (`@since`/`@example`/`@see`) tags, and `@ignore`/`@internal` from raw
 * JSDoc text (with or without `/**` delimiters). Standalone so `parse-entry-exports.ts` can read
 * sibling modules without a component parser context, same as {@link extractJsDocReturnType}.
 */
export function extractJsDocDeprecatedAndTags(commentValue: string): {
  deprecated?: DeprecatedValue;
  tags?: JsDocPassthroughTag[];
  internal: boolean;
} {
  const comment = parseComments(formatComment(commentValue));
  const { deprecated, passthrough, internal } = getCommentTags(comment);
  return { deprecated, tags: toPassthroughTags(passthrough), internal };
}

/** Tags {@link getCommentTags} handles structurally (or elsewhere), so they never land in `additional`. */
const EXCLUDED_TAGS = new Set([
  "type",
  "param",
  "returns",
  "return",
  "extends",
  "extendProps",
  "restProps",
  "slot",
  "snippet",
  "event",
  "typedef",
  "callback",
  "bindable",
  "deprecated",
  "ignore",
  "internal",
  "csspart",
  "cssprop",
  "cssproperty",
]);

/**
 * `parseComments` memoized per component on the raw comment text. The same
 * block is read more than once per parse (the leading-comment pass and
 * {@link buildVariableJsDocTable} both reach it); the parsed result is only
 * read by callers, never mutated, so sharing it is safe.
 */
export function parseCommentText(ctx: ParserContext, text: string): JSDocComment[] {
  let parsed = ctx.parsedJsDocByText.get(text);
  if (parsed === undefined) {
    parsed = parseComments(text);
    ctx.parsedJsDocByText.set(text, parsed);
  }
  return parsed;
}

export function getCommentTags(parsed: JSDocComment[]) {
  const tags = parsed[0]?.tags ?? [];

  let typeTag: (typeof tags)[number] | undefined;
  const paramTags: typeof tags = [];
  let returnsTag: (typeof tags)[number] | undefined;
  let binding: ComponentPropBinding | undefined;
  let deprecated: DeprecatedValue | undefined;
  let internal = false;
  const additionalTags: typeof tags = [];
  const passthroughTags: typeof tags = [];
  const ignoreCodes: string[] = [];

  for (const tag of tags) {
    if (tag.tag === "type") {
      typeTag = tag;
    } else if (tag.tag === "param") {
      paramTags.push(tag);
    } else if (tag.tag === "returns" || tag.tag === "return") {
      returnsTag = tag;
    } else if (tag.tag === "deprecated") {
      deprecated ??= deprecatedValueFromBody(tag.text);
    } else if (tag.tag === "ignore" || tag.tag === "internal") {
      internal = true;
    } else if (tag.tag === "sveld-ignore") {
      ignoreCodes.push(tag.name);
    } else if (IDE_PASSTHROUGH_TAGS.has(tag.tag)) {
      passthroughTags.push(tag);
    } else if (tag.tag === "bindable") {
      if (tag.type) {
        continue;
      }

      const value = `${tag.name}${tag.description ? ` ${tag.description}` : ""}`.trim();
      if (value === "readonly" || value === "writable") {
        binding ??= value;
      }
    } else if (!EXCLUDED_TAGS.has(tag.tag)) {
      additionalTags.push(tag);
    }
  }

  return {
    type: typeTag,
    param: paramTags,
    returns: returnsTag,
    binding,
    deprecated,
    internal,
    additional: additionalTags,
    passthrough: passthroughTags,
    ignore: ignoreCodes,
    description: parsed[0]?.description,
  };
}

/**
 * The block `parseCustomTypes` already parsed at this comment's offset, when it
 * spans exactly the same text acorn reported. The source scan only opens a
 * block whose `/**` leads its line and only closes on a line ending in `*\/`,
 * so a block found at the same `start` with the same `end` tokenizes to the
 * same lines as `formatComment(value)` would (the gutter strip discards the
 * indentation acorn's `onComment` removed). Anything else - `/** doc *\/ code`
 * on one line, `/***` ignore blocks - misses here and is parsed from `value`.
 */
function parsedSourceBlock(
  ctx: ParserContext,
  comment: { start?: unknown; end?: unknown },
): JSDocComment[] | undefined {
  if (typeof comment.start !== "number" || typeof comment.end !== "number") return undefined;
  const block = ctx.jsDocBlocksByStart.get(comment.start);
  if (block === undefined || block.end !== comment.end) return undefined;
  return [block];
}

function findJSDocComment(leadingComments: unknown[]): { value: string; start?: unknown; end?: unknown } | undefined {
  if (!leadingComments || leadingComments.length === 0) return undefined;
  const comment = leadingComments[leadingComments.length - 1];
  return comment && typeof comment === "object" && "value" in comment ? (comment as { value: string }) : undefined;
}

function findAdjacentJSDocComment(
  ctx: ParserContext,
  leadingComments: unknown[] | undefined,
  nodeStart: number | undefined,
): { value: string; start: number } | undefined {
  if (!leadingComments || leadingComments.length === 0 || nodeStart === undefined || !ctx.source) return undefined;

  for (let index = leadingComments.length - 1; index >= 0; index--) {
    const comment = leadingComments[index];
    if (!comment || typeof comment !== "object" || !("value" in comment) || !("end" in comment)) continue;
    if (typeof comment.end !== "number" || !("start" in comment) || typeof comment.start !== "number") continue;
    // A `//` line or plain `/* *\/` block (e.g. a lint suppression) isn't the doc comment.
    if (("type" in comment && comment.type === "Line") || !String(comment.value).startsWith("*")) continue;

    if (isJsDocGap(ctx.source, comment.end, nodeStart)) {
      return comment as { value: string; start: number };
    }
  }

  return undefined;
}

/**
 * Absolute `/**` start offsets of every JSDoc comment directly documenting a function: a
 * `function` declaration, a variable initialized with an arrow or function expression, or a
 * module-script class or one of its methods. A `@template` in one of these types that
 * function's own generic parameter, not the component's. The exception is an instance-script
 * `export let`: it's a prop, so its `@template` still declares a component generic.
 */
export function functionDocCommentStarts(ctx: ParserContext): Set<number> {
  const starts = new Set<number>();
  const addDocumented = (node: unknown) => {
    const { leadingComments, start } = node as { leadingComments?: unknown[]; start?: number };
    const comment = findAdjacentJSDocComment(ctx, leadingComments, start);
    if (comment) starts.add(comment.start);
  };
  for (const funcDecl of ctx.funcDecls.values()) addDocumented(funcDecl);

  // An exported declaration's doc comment sits on the `export` statement, not the declaration.
  const scripts = [
    { root: ctx.parsed?.module, isModule: true },
    { root: ctx.parsed?.instance, isModule: false },
  ];
  for (const { root, isModule } of scripts) {
    for (const statement of (root && scriptBody(root as Node)) ?? []) {
      const node = statement as { type: string; declaration?: FunctionDocCandidate | null };
      const isExported = node.type === "ExportNamedDeclaration";
      const declaration = isExported ? node.declaration : (node as FunctionDocCandidate);
      if (declaration?.type === "FunctionDeclaration") {
        if (isExported) addDocumented(node);
      } else if (declaration?.type === "ClassDeclaration" && isModule) {
        // A module-script class's `@template`s are its own, as are its methods'.
        addDocumented(isExported ? node : declaration);
        for (const member of declaration.body?.body ?? []) {
          if (member.type === "MethodDefinition") addDocumented(member);
        }
      } else if (
        declaration?.type === "VariableDeclaration" &&
        (isModule || !isExported || declaration.kind === "const") &&
        declaration.declarations?.length === 1 &&
        FUNCTION_EXPRESSION_TYPES.has(declaration.declarations[0].init?.type ?? "")
      ) {
        addDocumented(node);
      }
    }
  }
  return starts;
}

type FunctionDocCandidate = {
  type: string;
  kind?: string;
  declarations?: Array<{ init?: { type?: string } | null }>;
  /** A class's members. */
  body?: { body?: Array<{ type: string }> };
};

const FUNCTION_EXPRESSION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

export function processNodeJSDoc(
  ctx: ParserContext,
  node:
    | {
        leadingComments?: unknown[];
        start?: number;
      }
    | null
    | undefined,
) {
  if (!node?.leadingComments) return undefined;

  const jsdoc_comment = findAdjacentJSDocComment(ctx, node.leadingComments, node.start);
  if (!jsdoc_comment) return undefined;

  return processJSDocComment(ctx, [jsdoc_comment]);
}

export function processLeadingCommentsJSDoc(
  ctx: ParserContext,
  node:
    | {
        leadingComments?: unknown[];
        start?: number;
      }
    | null
    | undefined,
) {
  if (!node?.leadingComments) return undefined;
  return processNodeJSDoc(ctx, node);
}

/** One `@template` tag as a type parameter: `T`, `T extends Foo`, or `T extends Foo = Bar`. */
function templateTagConstraint(name: string, type: string, defaultValue: string | undefined): string {
  let constraint = name;
  if (type) constraint = `${name} extends ${type}`;
  if (defaultValue) constraint += ` = ${defaultValue}`;
  return constraint;
}

const TEMPLATE_FIRST_NAME_REGEX = /^[^\s,]+/;
const TEMPLATE_NEXT_NAME_REGEX = /^\s*,\s*([^\s,]+)/;

/**
 * Every type parameter one `@template` tag declares: `@template T, U` lists several. As in
 * TypeScript, a `{constraint}` or `[T=default]` applies to the first name only.
 */
export function templateTagParameters(tag: JSDocTag, type: string): Array<{ name: string; constraint: string }> {
  const firstName = tag.optional ? tag.name : TEMPLATE_FIRST_NAME_REGEX.exec(tag.name)?.[0];
  if (!firstName) return [];
  const parameters = [{ name: firstName, constraint: templateTagConstraint(firstName, type, tag.default) }];
  // Past the first name: the rest of an unspaced `T,U` name token, then the description.
  let rest = `${tag.optional ? "" : tag.name.slice(firstName.length)} ${tag.description}`;
  for (let match = TEMPLATE_NEXT_NAME_REGEX.exec(rest); match; match = TEMPLATE_NEXT_NAME_REGEX.exec(rest)) {
    parameters.push({ name: match[1], constraint: match[1] });
    rest = rest.slice(match[0].length);
  }
  return parameters;
}

function processJSDocComment(ctx: ParserContext, leadingComments: unknown[]): NodeJsDoc | undefined {
  if (!leadingComments) return undefined;

  const jsdoc_comment = findJSDocComment(leadingComments);
  if (!jsdoc_comment) return undefined;

  const comment = parsedSourceBlock(ctx, jsdoc_comment) ?? parseCommentText(ctx, formatComment(jsdoc_comment.value));

  const {
    type: typeTag,
    param: paramTags,
    returns: returnsTag,
    binding,
    deprecated,
    internal,
    additional: additionalTags,
    passthrough: passthroughTags,
    ignore: ignoreCodes,
    description: commentDescription,
  } = getCommentTags(comment);

  let type: string | undefined;
  let params: ComponentPropParam[] | undefined;
  let returnType: string | undefined;
  let description: string | undefined;

  // `@type` overrides inferred initializer type
  if (typeTag) type = aliasType(typeTag.type);

  if (paramTags.length > 0) {
    params = paramTags
      .filter((tag) => !tag.name.includes("."))
      .map((tag) => ({
        name: tag.name,
        type: aliasType(tag.type),
        description: cleanDescription(joinDescriptionLines(tag.description.split("\n"))),
        optional: tag.optional || false,
      }));
  }

  if (returnsTag) returnType = aliasType(returnsTag.type);

  // A function's own `@template`s become its type parameters instead of description text.
  let typeParameters: string | undefined;
  let descriptionTags = additionalTags;
  if (typeof jsdoc_comment.start === "number" && ctx.functionDocCommentStarts.has(jsdoc_comment.start)) {
    const templateTags = additionalTags.filter((tag) => tag.tag === "template" && tag.name);
    if (templateTags.length > 0) {
      typeParameters = templateTags
        .flatMap((tag) => templateTagParameters(tag, aliasType(tag.type)))
        .map(({ constraint }) => constraint)
        .join(", ");
      descriptionTags = additionalTags.filter((tag) => tag.tag !== "template");
    }
  }

  const formattedDescription = assignValueOrUndefined(commentDescription?.trim());
  if (formattedDescription || descriptionTags.length > 0) {
    const descriptionParts: string[] = [];
    if (formattedDescription) {
      descriptionParts.push(formattedDescription);
    }
    for (const tag of descriptionTags) {
      // Rebuilt from the text as written, so a `{...}` in it (`@default { a: 1 }`) survives.
      descriptionParts.push(`@${tag.tag}${tag.text ? ` ${tag.text}` : ""}`);
    }
    description = descriptionParts.join("\n");
  }

  return {
    type,
    params,
    returnType,
    description,
    binding,
    deprecated,
    tags: toPassthroughTags(passthroughTags),
    sveldIgnore: ignoreCodes.length > 0 ? ignoreCodes : undefined,
    internal,
    typeParameters,
  };
}
