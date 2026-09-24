import type { Node } from "estree";
import type ComponentParser from "../ComponentParser";
import type {
  ComponentPropBinding,
  ComponentPropParam,
  DeprecatedValue,
  JsDocPassthroughTag,
  SourceRange,
} from "../ComponentParser";
import type { JSDocComment, JSDocTag } from "./comment-parser";
import { parseComments } from "./comment-parser";
import type { ParserContext } from "./context";
import { recordDiagnostic, recordSveldIgnore } from "./diagnostics";
import { addDispatchedEvent, buildEventDetailFromProperties } from "./events";
import { splitTopLevelCommas } from "./generics";
import { addSlot } from "./slots";
import { sourceRangeFromCommentTag } from "./source-position";
import { assignValueOrUndefined } from "./utils";
import { scriptBody } from "./value-imports";

const GENERIC_DEFAULT_EQUALS_REGEX = /\s*=\s*/;

/**
 * Normalizes spacing in a `@typedef`/`@callback` tag's generic suffix, as
 * literally written by the author (e.g. `Name<Row=DataTableRow,Header=Foo>`),
 * to `Name<Row = DataTableRow, Header = Foo>` — matching how every other
 * generic parameter list sveld emits is spaced.
 */
function normalizeGenericNameSpacing(name: string): string {
  const openIndex = name.indexOf("<");
  if (openIndex === -1 || !name.endsWith(">")) return name;

  const base = name.slice(0, openIndex);
  const params = name.slice(openIndex + 1, -1);
  const normalizedParams = splitTopLevelCommas(params)
    .map((param) => param.trim().replace(GENERIC_DEFAULT_EQUALS_REGEX, " = "))
    .join(", ");

  return `${base}<${normalizedParams}>`;
}

export const ONLY_WHITESPACE_REGEX = /^\s*$/;

const TRAILING_SEMICOLON_REGEX = /;$/;

const DESCRIPTION_DASH_PREFIX_REGEX = /^-\s*/;

/** Strips each line's indentation, so a wrapped tag description reads as plain lines. */
function dedentLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

function cleanDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const cleaned = description.replace(DESCRIPTION_DASH_PREFIX_REGEX, "").trim();
  return cleaned === "" ? "" : cleaned;
}

/**
 * Tags that take the description lines directly above them when they have none on their own
 * line (sveld's description-above-the-tag convention), e.g. a line of prose then `@event`.
 */
const PRECEDING_DESCRIPTION_TAGS = new Set(["restProps", "slot", "snippet", "event", "typedef", "callback"]);

/** Tags that stay inside the preceding `@event`'s scope instead of ending it. */
const EVENT_SCOPE_TAGS = new Set(["property", "type"]);

/**
 * Returns the description text that appears on the same line as the tag itself, ignoring
 * continuation lines that `parseComments` aggregated into the tag's `description` field. A
 * multi-line `{type}` moves that line down to where the type closes.
 */
function getInlineTagDescription(
  tagLines: Array<{ content: string; continuesType?: true }> | undefined,
): string | undefined {
  if (!tagLines || tagLines.length === 0) return undefined;
  let headIndex = 0;
  while (tagLines[headIndex + 1]?.continuesType) headIndex++;
  return tagLines[headIndex].content;
}

/** `@since`, `@example`, and `@see` are kept out of prose descriptions and exposed as `tags` instead. */
const IDE_PASSTHROUGH_TAGS = new Set(["since", "example", "see"]);

/**
 * Tags sveld gives meaning to somewhere other than `parseCustomTypes`'s own
 * switch below: `@bindable` is handled per-prop in {@link getCommentTags},
 * and `@default`/`@required` are conventional documentation tags sveld
 * doesn't act on but doesn't consider a typo either. Anything reaching the
 * `default:` case that isn't in this set or `IDE_PASSTHROUGH_TAGS` is flagged
 * as `jsdoc-unknown-tag`.
 */
const OTHER_KNOWN_JSDOC_TAGS = new Set(["bindable", "default", "required"]);

function deprecatedValueFromBody(body: string): DeprecatedValue {
  const message = body.trim();
  return message === "" ? true : message;
}

function deprecatedValueFromParts(name: string | undefined, description: string | undefined): DeprecatedValue {
  return deprecatedValueFromBody(`${name ?? ""}${description ? ` ${description}` : ""}`);
}

/**
 * True when `source` is one balanced `{...}` (optional trailing `;`).
 * Unions like `{...} | {...}` must stay `type` aliases, not `interface`.
 */
function isSingleObjectLiteral(source: string): boolean {
  const s = source.trim().replace(TRAILING_SEMICOLON_REGEX, "").trimEnd();
  if (!s.startsWith("{") || !s.endsWith("}")) return false;

  let depth = 0;
  let stringDelimiter: '"' | "'" | "`" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (stringDelimiter !== null) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringDelimiter) stringDelimiter = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      stringDelimiter = ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      // The opening `{` closed before the end of the string, so there must
      // be additional top-level content (e.g. `{...} | {...}`).
      if (depth === 0 && i < s.length - 1) return false;
    }
  }
  return depth === 0;
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

/** Map JSDoc `"*"` to `"any"`; otherwise trim. Same rules as {@link ComponentParser.aliasType}. */
function aliasType(type: string): string {
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
  const { deprecated, passthrough: passthroughTags, internal } = getCommentTags(comment);

  const tags: JsDocPassthroughTag[] | undefined =
    passthroughTags.length > 0 ? passthroughTags.map((tag) => ({ name: tag.tag, body: tag.raw })) : undefined;

  return { deprecated, tags, internal };
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
      deprecated ??= deprecatedValueFromParts(tag.name, tag.description);
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

    const between = ctx.source.slice(comment.end, nodeStart);
    if (ONLY_WHITESPACE_REGEX.test(between)) {
      return comment as { value: string; start: number };
    }
  }

  return undefined;
}

/**
 * Absolute `/**` start offsets of every JSDoc comment directly documenting a function: a
 * `function` declaration (module or instance script, exported or not), or a variable initialized
 * with an arrow or function expression, except an instance-script `export let`. A `@template`
 * tag in one of these blocks types that function's own generic parameter, standard JSDoc usage
 * unrelated to sveld's `@generics`/`@template` component-generics feature, and must not be
 * folded into the component's class/props generic parameter list the way a `@generics`-adjacent
 * one is. An instance-script `export let` is a prop, so a `@template` on one still declares a
 * component generic; an `export const` is a read-only accessor, not a prop.
 */
function functionDocCommentStarts(ctx: ParserContext): Set<number> {
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
};

const FUNCTION_EXPRESSION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

export function processNodeJSDoc(
  ctx: ParserContext,
  parser: ComponentParser,
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

  return processJSDocComment(ctx, parser, [jsdoc_comment]);
}

export function processLeadingCommentsJSDoc(
  ctx: ParserContext,
  parser: ComponentParser,
  node:
    | {
        leadingComments?: unknown[];
        start?: number;
      }
    | null
    | undefined,
) {
  if (!node?.leadingComments) return undefined;
  return processNodeJSDoc(ctx, parser, node);
}

/** One `@template` tag as a type parameter: `T`, `T extends Foo`, or `T extends Foo = Bar`. */
function templateTagConstraint(name: string, type: string, defaultValue: string | undefined): string {
  let constraint = name;
  if (type) constraint = `${name} extends ${type}`;
  if (defaultValue) constraint += ` = ${defaultValue}`;
  return constraint;
}

function processJSDocComment(
  ctx: ParserContext,
  parser: ComponentParser,
  leadingComments: unknown[],
):
  | {
      type?: string;
      params?: ComponentPropParam[];
      returnType?: string;
      description?: string;
      binding?: ComponentPropBinding;
      deprecated?: DeprecatedValue;
      tags?: JsDocPassthroughTag[];
      /** `@sveld-ignore <code>` codes from this comment; `""` means "ignore anything for this symbol". */
      sveldIgnore?: string[];
      /** True when `@ignore` or `@internal` is present; excludes this prop from every output. */
      internal: boolean;
      /** `@template` tags of a comment documenting a function, as its type parameter list (`T extends Foo, U`). */
      typeParameters?: string;
    }
  | undefined {
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
  if (typeTag) type = parser.aliasType(typeTag.type);

  if (paramTags.length > 0) {
    params = paramTags
      .filter((tag) => !tag.name.includes("."))
      .map((tag) => ({
        name: tag.name,
        type: parser.aliasType(tag.type),
        description: cleanDescription(dedentLines(tag.description)),
        optional: tag.optional || false,
      }));
  }

  if (returnsTag) returnType = parser.aliasType(returnsTag.type);

  // A function's own `@template`s become its type parameters instead of description text.
  let typeParameters: string | undefined;
  let descriptionTags = additionalTags;
  if (typeof jsdoc_comment.start === "number" && ctx.functionDocCommentStarts.has(jsdoc_comment.start)) {
    const templateTags = additionalTags.filter((tag) => tag.tag === "template" && tag.name);
    if (templateTags.length > 0) {
      typeParameters = templateTags
        .map((tag) => templateTagConstraint(tag.name, parser.aliasType(tag.type), tag.default))
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
      const tagStr = `@${tag.tag}${tag.name ? ` ${tag.name}` : ""}${tag.description ? ` ${tag.description}` : ""}`;
      descriptionParts.push(tagStr);
    }
    description = descriptionParts.join("\n");
  }

  const tags: JsDocPassthroughTag[] | undefined =
    passthroughTags.length > 0
      ? passthroughTags.map((tag) => ({
          name: tag.tag,
          body: tag.raw,
        }))
      : undefined;

  return {
    type,
    params,
    returnType,
    description,
    binding,
    deprecated,
    tags,
    sveldIgnore: ignoreCodes.length > 0 ? ignoreCodes : undefined,
    internal,
    typeParameters,
  };
}

export function parseCustomTypes(
  ctx: ParserContext,
  parser: ComponentParser,
  scanSource: string | undefined = ctx.source,
) {
  if (!scanSource) return;
  /** Cross-block bookkeeping for `@generics`/`@template` duplicate/mixed-tag warnings. */
  let usedGenericsTag = false;
  let usedTemplateTag = false;
  let warnedMixedGenericsTags = false;
  const seenGenericNames = new Set<string>();
  const warnMixedGenericsTags = () => {
    if (usedGenericsTag && usedTemplateTag && !warnedMixedGenericsTags) {
      warnedMixedGenericsTags = true;
      const location = ctx.componentFilePath ? ` in ${ctx.componentFilePath}` : "";
      console.warn(
        `Warning: Both @generics and @template tags are used to declare component generics${location}; their declarations are combined in the order encountered.`,
      );
    }
  };
  const warnAndTrackGenericName = (genericName: string, source: SourceRange | undefined) => {
    if (seenGenericNames.has(genericName)) {
      recordDiagnostic(ctx, "generics-conflict", genericName, `Duplicate generic name "${genericName}".`, source);
    } else {
      seenGenericNames.add(genericName);
    }
  };
  /**
   * Accumulates a `@generics`/`@template` declaration, replacing an earlier
   * declaration in place when `declaredName` was already declared - so
   * redeclaring the same generic (e.g. via both tags) updates its constraint
   * instead of appending a second, invalid duplicate type parameter.
   */
  const accumulateOrReplaceGeneric = (declaredName: string, constraint: string) => {
    if (ctx.generics) {
      const names = splitTopLevelCommas(ctx.generics[0]).map((n) => n.trim());
      const existingIndex = names.indexOf(declaredName.trim());
      if (existingIndex !== -1) {
        const constraints = splitTopLevelCommas(ctx.generics[1]).map((c) => c.trim());
        constraints[existingIndex] = constraint;
        ctx.generics = [ctx.generics[0], constraints.join(", ")];
        return;
      }
    }
    parser.accumulateGeneric(declaredName, constraint);
  };
  /** `ctx.typedefs` holds both `@typedef` and `@callback` declarations, keyed by name; both finalizers share this check. */
  const warnDuplicateTypedefName = (name: string, source: SourceRange | undefined) => {
    if (ctx.typedefs.has(name)) {
      recordDiagnostic(
        ctx,
        "typedef-duplicate",
        name,
        `Duplicate typedef/callback name "${name}"; the later declaration overwrites the earlier one.`,
        source,
      );
    }
  };
  /**
   * Replaces an earlier `@property` with the same name instead of pushing a
   * second entry - two properties with the same key would otherwise appear
   * in the emitted object type.
   */
  const pushOrReplaceProperty = <T extends { name: string }>(
    list: T[],
    property: T,
    ownerName: string | undefined,
    source: SourceRange | undefined,
  ) => {
    const existingIndex = list.findIndex((p) => p.name === property.name);
    if (existingIndex === -1) {
      list.push(property);
    } else {
      const owner = ownerName ? ` of "${ownerName}"` : "";
      recordDiagnostic(
        ctx,
        "property-duplicate",
        property.name,
        `Duplicate property "${property.name}"${owner}; the later declaration overwrites the earlier one.`,
        source,
      );
      list[existingIndex] = property;
    }
  };
  // Only a `@template` tag reads this set, so skip the statement scan without one.
  const functionDocStarts = scanSource.includes("@template") ? functionDocCommentStarts(ctx) : new Set<number>();
  ctx.functionDocCommentStarts = functionDocStarts;
  const blocks = parseComments(scanSource);
  // Leading-comment lookups during the main walk reuse these instead of
  // re-tokenizing each block from acorn's comment value (see `parsedSourceBlock`).
  for (const block of blocks) ctx.jsDocBlocksByStart.set(block.start, block);
  for (const { tags, description: commentDescription, lines: blockLines, start: blockStart } of blocks) {
    const blockDocumentsFunction = functionDocStarts.has(blockStart);
    let currentEventName: string | undefined;
    let currentEventType: string | undefined;
    let currentEventDescription: string | undefined;
    let currentEventDeprecated: DeprecatedValue | undefined;
    let currentEventInternal = false;
    let currentEventSource: SourceRange | undefined;
    let currentEventTagLine: number | undefined;
    let currentEventTags: JsDocPassthroughTag[] = [];
    let currentEventIgnores: string[] = [];
    const eventProperties: Array<{
      name: string;
      type: string;
      description?: string;
      optional?: boolean;
      default?: string;
    }> = [];

    let currentTypedefName: string | undefined;
    let currentTypedefType: string | undefined;
    let currentTypedefDescription: string | undefined;
    let currentTypedefSource: SourceRange | undefined;
    let currentTypedefTags: JsDocPassthroughTag[] = [];
    let currentTypedefInternal = false;
    const typedefProperties: Array<{
      name: string;
      type: string;
      description?: string;
      optional?: boolean;
      default?: string;
    }> = [];

    let currentCallbackName: string | undefined;
    let currentCallbackDescription: string | undefined;
    let currentCallbackSource: SourceRange | undefined;
    let currentCallbackTags: JsDocPassthroughTag[] = [];
    let currentCallbackInternal = false;
    const callbackParams: Array<{
      name: string;
      type: string;
      optional?: boolean;
    }> = [];
    let callbackReturnType: string | undefined;

    /**
     * Where a passthrough tag (`@since`, `@see`, an unknown tag, ...) attaches
     * once a structural tag (`@slot`/`@snippet`/`@event`/`@typedef`/`@callback`)
     * has been seen in this block: set every time one starts, so a tag
     * trailing it attaches to it directly instead of queuing in `pendingTags`
     * for whatever structural tag happens to come next.
     */
    let attachTrailingTag: ((tag: JsDocPassthroughTag) => void) | undefined;

    let commentDescriptionUsed = false;
    let isFirstTag = true;
    const pendingTags: JsDocPassthroughTag[] = [];
    /** `@deprecated` for the next `@slot` / `@snippet` in this block. */
    let pendingDeprecated: DeprecatedValue | undefined;
    /** `@ignore`/`@internal` for the next `@slot`/`@snippet`/`@typedef`/`@callback` in this block. */
    let pendingInternal = false;

    const lineDescriptions = new Map<number, string>();
    const tagLineNumbers = new Set<number>();
    /** Lines already used as preceding-description for another tag. */
    const consumedDescriptionLines = new Set<number>();
    for (const tagInfo of tags) {
      if (tagInfo.lines.length > 0) {
        tagLineNumbers.add(tagInfo.lines[0].number);
      }
    }
    // A multi-line `{type}`'s lines, including the one where it closes, belong to the tag's
    // opening line: their text is the tag's inline description, never a continuation line.
    for (const line of blockLines) {
      if (line.continuesType) tagLineNumbers.add(line.number);
    }
    /**
     * Indented lines directly under a tag's line: that tag's wrapped description, never the
     * description of the tag after it. Unindented text between two tags stays ambiguous and
     * keeps the description-above-the-tag reading.
     */
    const indentedContinuationLines = new Set<number>();
    let inIndentedContinuation = false;
    for (const line of blockLines) {
      // A line whose only remaining content is a lone "}" is the tail of a multi-line `{...}`
      // type, not prose - it must not get attributed to any tag as a description.
      if (!line.tag && !line.continuesType && line.content && line.content.trim() !== "}") {
        lineDescriptions.set(line.number, line.content);
      }
      if (line.tag !== undefined || line.continuesType) {
        inIndentedContinuation = true;
      } else if (inIndentedContinuation && line.indent && line.content.trim()) {
        indentedContinuationLines.add(line.number);
      } else {
        inIndentedContinuation = false;
      }
    }

    /** Description lines immediately above a tag (not continuation lines the tag's own body absorbed). */
    const getPrecedingDescription = (tagSource: typeof blockLines): string | undefined => {
      if (!tagSource || tagSource.length === 0) return undefined;
      const tagLineNumber = tagSource[0].number;

      const descLines: string[] = [];
      const claimedLineNums: number[] = [];
      let foundDescriptionBlock = false;

      for (let lineNum = tagLineNumber - 1; lineNum >= 0; lineNum--) {
        if (tagLineNumbers.has(lineNum) || indentedContinuationLines.has(lineNum)) {
          break;
        }

        const desc = lineDescriptions.get(lineNum);
        if (desc) {
          descLines.unshift(desc);
          claimedLineNums.unshift(lineNum);
          foundDescriptionBlock = true;
        } else if (foundDescriptionBlock) {
          const sourceLine = blockLines[lineNum];
          const isBlank = !sourceLine || (!sourceLine.tag && (!sourceLine.content || sourceLine.content.trim() === ""));
          if (!isBlank) {
            break;
          }
        }
      }
      if (descLines.length === 0) return undefined;
      for (const n of claimedLineNums) consumedDescriptionLines.add(n);
      return descLines.join("\n").trim();
    };

    /**
     * A tag's own description: the text on its line plus its continuation lines, which run to
     * the next tag as in JSDoc and TypeScript. When that next tag has no description of its own
     * and takes the text above it instead (see {@link PRECEDING_DESCRIPTION_TAGS}), unindented
     * lines are left for it, preserving sveld's description-above-the-tag convention. The same
     * goes for the last tag in an `@event`'s scope, whose trailing text describes the event.
     */
    const getTagDescription = (tagSource: typeof blockLines, nextTag: JSDocTag | undefined): string | undefined => {
      const inline = cleanDescription(getInlineTagDescription(tagSource));
      const nextTagTakesTextAbove =
        nextTag !== undefined &&
        PRECEDING_DESCRIPTION_TAGS.has(nextTag.tag) &&
        !cleanDescription(getInlineTagDescription(nextTag.lines));
      // Unindented text after an event's last `@property`/`@type` is the event's own description.
      const endsEventScope =
        currentEventName !== undefined && (nextTag === undefined || !EVENT_SCOPE_TAGS.has(nextTag.tag));

      const continuation: string[] = [];
      for (let index = 1; index < tagSource.length; index++) {
        const line = tagSource[index];
        if ((nextTagTakesTextAbove || endsEventScope) && !indentedContinuationLines.has(line.number)) continue;
        const text = lineDescriptions.get(line.number)?.trim();
        if (!text || consumedDescriptionLines.has(line.number)) continue;
        continuation.push(text);
        consumedDescriptionLines.add(line.number);
      }
      if (continuation.length === 0) return inline;
      return [inline, ...continuation].filter(Boolean).join("\n");
    };

    /**
     * Unindented text right after an `@event` (or after its last `@property`/`@type`) is read
     * as the description of the tag below it, per the description-above-the-tag convention.
     * When that leaves the event with no description, the author likely meant the text for the
     * event, so flag the attribution instead of guessing.
     */
    const flagDescriptionAfterEvent = (
      tag: string,
      name: string,
      tagSource: typeof blockLines,
      previousTag: JSDocTag | undefined,
    ) => {
      if (currentEventName === undefined || currentEventDescription) return;
      // Indented lines under the `@event` are its description; they're merged in later.
      if (currentEventTagLine !== undefined && indentedContinuationLines.has(currentEventTagLine + 1)) return;
      if (previousTag?.tag !== "event" && !EVENT_SCOPE_TAGS.has(previousTag?.tag ?? "")) return;
      if (cleanDescription(getInlineTagDescription(tagSource))) return;
      const label = name ? `@${tag} "${name}"` : `@${tag}`;
      recordDiagnostic(
        ctx,
        "event-description-ambiguous",
        currentEventName,
        `Text after @event "${currentEventName}" was used as the description of ${label}. Move it above the tag it describes, indent it as a continuation line, or give each event its own comment block.`,
        sourceRangeFromCommentTag(ctx, tagSource),
      );
    };

    const finalizeEvent = () => {
      if (currentEventName !== undefined) {
        // Prefer explicit `@type` over `@property`-built objects; `{object}` falls through.
        const explicitType =
          currentEventType && currentEventType !== "object" && currentEventType !== "Object"
            ? currentEventType
            : undefined;
        let detailType: string;
        if (explicitType) {
          detailType = explicitType;
        } else if (eventProperties.length > 0) {
          detailType = buildEventDetailFromProperties(eventProperties, currentEventName, true);
        } else {
          detailType = currentEventType || "";
        }

        if (currentEventTagLine !== undefined) {
          let scopeBoundaryLine: number | undefined;
          for (const t of tags) {
            const tLine = t.lines[0]?.number;
            if (typeof tLine !== "number") continue;
            if (tLine <= currentEventTagLine) continue;
            if (EVENT_SCOPE_TAGS.has(t.tag)) continue;
            scopeBoundaryLine = tLine;
            break;
          }
          const trailing: string[] = [];
          const sortedLineNums = Array.from(lineDescriptions.keys()).sort((a, b) => a - b);
          for (const lineNum of sortedLineNums) {
            if (lineNum <= currentEventTagLine) continue;
            if (scopeBoundaryLine !== undefined && lineNum >= scopeBoundaryLine) continue;
            if (consumedDescriptionLines.has(lineNum)) continue;
            const desc = lineDescriptions.get(lineNum);
            const trimmed = desc?.trim();
            if (trimmed) {
              trailing.push(trimmed);
              consumedDescriptionLines.add(lineNum);
            }
          }
          if (trailing.length > 0) {
            const trailingText = trailing.join("\n");
            currentEventDescription = currentEventDescription
              ? `${currentEventDescription}\n${trailingText}`
              : trailingText;
          }
        }

        addDispatchedEvent(ctx, {
          name: currentEventName,
          detail: detailType,
          has_argument: false,
          description: currentEventDescription,
          deprecated: currentEventDeprecated,
          tags: currentEventTags.length > 0 ? currentEventTags : undefined,
          internal: currentEventInternal || undefined,
          source: currentEventSource,
        });
        ctx.eventDescriptions.set(currentEventName, currentEventDescription);
        ctx.jsDocEventNames.add(currentEventName);
        ctx.jsDocEventSources.set(currentEventName, currentEventSource);
        recordSveldIgnore(ctx, "event-no-source", currentEventName, currentEventIgnores);
        eventProperties.length = 0;
        currentEventName = undefined;
        currentEventType = undefined;
        currentEventDescription = undefined;
        currentEventDeprecated = undefined;
        currentEventInternal = false;
        currentEventSource = undefined;
        currentEventTagLine = undefined;
        currentEventTags = [];
        currentEventIgnores = [];
      }
    };

    const finalizeTypedef = () => {
      if (currentTypedefName !== undefined) {
        let typedefType: string;
        let typedefTs: string;

        if (typedefProperties.length > 0) {
          typedefType = buildEventDetailFromProperties(typedefProperties, undefined, true);
          typedefTs = `type ${currentTypedefName} = ${typedefType};`;
        } else if (currentTypedefType) {
          typedefType = currentTypedefType;
          typedefTs = isSingleObjectLiteral(typedefType)
            ? `interface ${currentTypedefName} ${typedefType}`
            : `type ${currentTypedefName} = ${typedefType};`;
        } else {
          typedefType = "{}";
          typedefTs = `type ${currentTypedefName} = ${typedefType};`;
        }

        warnDuplicateTypedefName(currentTypedefName, currentTypedefSource);
        ctx.typedefs.set(currentTypedefName, {
          type: typedefType,
          name: currentTypedefName,
          description: assignValueOrUndefined(currentTypedefDescription),
          ts: typedefTs,
          tags: currentTypedefTags.length > 0 ? currentTypedefTags : undefined,
          ...(currentTypedefInternal ? { internal: true as const } : {}),
          source: currentTypedefSource,
        });

        typedefProperties.length = 0;
        currentTypedefName = undefined;
        currentTypedefType = undefined;
        currentTypedefDescription = undefined;
        currentTypedefSource = undefined;
        currentTypedefTags = [];
        currentTypedefInternal = false;
      }
    };

    const finalizeCallback = () => {
      if (currentCallbackName !== undefined) {
        const params = callbackParams
          .map(({ name, type, optional }) => {
            const optionalMarker = optional ? "?" : "";
            return `${name}${optionalMarker}: ${type}`;
          })
          .join(", ");
        const returnType = callbackReturnType || "void";
        const callbackType = `(${params}) => ${returnType}`;
        const callbackTs = `type ${currentCallbackName} = ${callbackType};`;

        warnDuplicateTypedefName(currentCallbackName, currentCallbackSource);
        ctx.typedefs.set(currentCallbackName, {
          type: callbackType,
          name: currentCallbackName,
          description: assignValueOrUndefined(currentCallbackDescription),
          ts: callbackTs,
          tags: currentCallbackTags.length > 0 ? currentCallbackTags : undefined,
          ...(currentCallbackInternal ? { internal: true as const } : {}),
          source: currentCallbackSource,
        });

        callbackParams.length = 0;
        callbackReturnType = undefined;
        currentCallbackName = undefined;
        currentCallbackDescription = undefined;
        currentCallbackSource = undefined;
        currentCallbackTags = [];
        currentCallbackInternal = false;
      }
    };

    /**
     * `@template` with `@slot`/`@snippet` is slot prose only, unless `@extends`
     * is in the same block (then it parameterizes inherited props).
     */
    const blockHasSlotOrSnippetTag = tags.some((t) => t.tag === "slot" || t.tag === "snippet");
    const blockHasExtendsTag = tags.some((t) => t.tag === "extends" || t.tag === "extendProps");
    /**
     * Whether this block declares anything `pendingTags` can attach to. A plain
     * prop or context comment with just a `@since`/`@example`/`@see` tag has no
     * such tag, so a leftover passthrough tag there is expected, not dropped -
     * that comment's own tags are captured separately by `processJSDocComment`.
     */
    const blockHasStructuralTag = tags.some(
      (t) =>
        t.tag === "slot" || t.tag === "snippet" || t.tag === "event" || t.tag === "typedef" || t.tag === "callback",
    );

    for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
      const {
        tag,
        type: tagType,
        name,
        description,
        optional,
        default: defaultValue,
        raw,
        lines: tagSource,
      } = tags[tagIndex];
      // Sections are split in line order, so neighbors in `tags` are neighbors in the block.
      const nextTag = tags[tagIndex + 1];
      const type = parser.aliasType(tagType);
      // Only tags that can use it claim the text above them; a `@property` or `@type` must not
      // swallow the lines between an `@event` and itself, or a previous tag's continuation lines.
      const precedingDescription = PRECEDING_DESCRIPTION_TAGS.has(tag) ? getPrecedingDescription(tagSource) : undefined;
      if (precedingDescription) flagDescriptionAfterEvent(tag, name, tagSource, tags[tagIndex - 1]);

      switch (tag) {
        case "extends":
        case "extendProps":
          if (ctx.extends !== undefined) {
            recordDiagnostic(
              ctx,
              "extend-props-duplicate",
              name,
              `A second @extends/@extendProps tag ("${name}") overwrote the first ("${ctx.extends.interface}"); only one is used.`,
              sourceRangeFromCommentTag(ctx, tagSource),
            );
          }
          ctx.extends = {
            interface: name,
            import: type,
          };
          if (isFirstTag) isFirstTag = false;
          break;
        case "restProps": {
          const rawInlineDesc = name ? (description ? `${name} ${description}` : name) : description;
          const inlineRestPropsDesc = cleanDescription(rawInlineDesc);
          let restPropsDesc = inlineRestPropsDesc || precedingDescription;
          if (!restPropsDesc && isFirstTag && !commentDescriptionUsed && commentDescription) {
            restPropsDesc = commentDescription;
            commentDescriptionUsed = true;
          }
          ctx.rest_props = {
            type: "Element",
            name: type,
            description: restPropsDesc || undefined,
          };
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "slot":
        case "snippet": {
          const inlineSlotDesc = getTagDescription(tagSource, nextTag);
          let slotDesc = inlineSlotDesc;
          if (!slotDesc && isFirstTag && !commentDescriptionUsed && commentDescription) {
            slotDesc = commentDescription;
            commentDescriptionUsed = true;
          }
          if (!slotDesc && pendingTags.length === 0) {
            slotDesc = precedingDescription;
          }
          if (isFirstTag) isFirstTag = false;
          let slotType = type;
          if (!slotType) {
            slotType = "Record<string, never>";
            recordDiagnostic(
              ctx,
              "slot-missing-type",
              name || "default",
              `@${tag}${name ? ` "${name}"` : ""} is missing a required {Type} annotation; falling back to "${slotType}".`,
              sourceRangeFromCommentTag(ctx, tagSource),
            );
          }
          addSlot(ctx, {
            slot_name: name,
            slot_props: slotType,
            slot_description: slotDesc || undefined,
            slot_deprecated: pendingDeprecated,
            slot_tags: pendingTags.length > 0 ? [...pendingTags] : undefined,
            slot_internal: pendingInternal || undefined,
            source: sourceRangeFromCommentTag(ctx, tagSource),
          });
          pendingTags.length = 0;
          pendingDeprecated = undefined;
          pendingInternal = false;
          {
            const slotKey = name === undefined || name === "" ? null : name;
            attachTrailingTag = (trailingTag) => {
              const slot = ctx.slots.get(slotKey);
              if (slot) slot.tags = [...(slot.tags ?? []), trailingTag];
            };
          }
          break;
        }
        case "csspart": {
          const partDescription = getTagDescription(tagSource, nextTag);
          ctx.cssParts.push({
            name,
            ...(partDescription ? { description: partDescription } : {}),
          });
          break;
        }
        case "cssprop":
        case "cssproperty": {
          const propertyDescription = getTagDescription(tagSource, nextTag);
          ctx.cssProperties.push({
            name,
            ...(type ? { type } : {}),
            ...(defaultValue === undefined ? {} : { default: defaultValue }),
            ...(propertyDescription ? { description: propertyDescription } : {}),
          });
          break;
        }
        case "event": {
          finalizeEvent();

          currentEventName = name;
          currentEventType = type;
          currentEventTagLine = tagSource.length > 0 ? tagSource[0].number : undefined;
          const inlineEventDesc = cleanDescription(getInlineTagDescription(tagSource));
          currentEventDescription = inlineEventDesc || precedingDescription;
          if (!currentEventDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentEventDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          currentEventSource = sourceRangeFromCommentTag(ctx, tagSource);
          if (pendingTags.length > 0) {
            currentEventTags.push(...pendingTags);
            pendingTags.length = 0;
          }
          attachTrailingTag = (trailingTag) => currentEventTags.push(trailingTag);
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "type":
          if (currentEventName !== undefined) {
            currentEventType = type;
          }
          break;
        case "param":
          if (currentCallbackName !== undefined) {
            callbackParams.push({ name, type, optional: optional || false });
          }
          break;
        case "returns":
        case "return":
          if (currentCallbackName !== undefined) {
            callbackReturnType = type;
          }
          break;
        case "property": {
          const propertyData = {
            name,
            type,
            description: getTagDescription(tagSource, nextTag),
            optional: optional || false,
            default: defaultValue,
          };

          if (currentEventName !== undefined) {
            pushOrReplaceProperty(
              eventProperties,
              propertyData,
              currentEventName,
              sourceRangeFromCommentTag(ctx, tagSource),
            );
          } else if (currentTypedefName !== undefined) {
            pushOrReplaceProperty(
              typedefProperties,
              propertyData,
              currentTypedefName,
              sourceRangeFromCommentTag(ctx, tagSource),
            );
          }
          break;
        }
        case "typedef": {
          finalizeTypedef();

          currentTypedefName = normalizeGenericNameSpacing(name);
          currentTypedefType = type;
          currentTypedefSource = sourceRangeFromCommentTag(ctx, tagSource);
          const inlineTypedefDesc = getTagDescription(tagSource, nextTag);
          currentTypedefDescription = inlineTypedefDesc || precedingDescription;
          if (!currentTypedefDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentTypedefDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          if (pendingTags.length > 0) {
            currentTypedefTags.push(...pendingTags);
            pendingTags.length = 0;
          }
          currentTypedefInternal = pendingInternal;
          pendingInternal = false;
          attachTrailingTag = (trailingTag) => currentTypedefTags.push(trailingTag);
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "callback": {
          finalizeCallback();

          currentCallbackName = normalizeGenericNameSpacing(name);
          currentCallbackSource = sourceRangeFromCommentTag(ctx, tagSource);
          const inlineCallbackDesc = getTagDescription(tagSource, nextTag);
          currentCallbackDescription = inlineCallbackDesc || precedingDescription;
          if (!currentCallbackDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentCallbackDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          if (pendingTags.length > 0) {
            currentCallbackTags.push(...pendingTags);
            pendingTags.length = 0;
          }
          currentCallbackInternal = pendingInternal;
          pendingInternal = false;
          attachTrailingTag = (trailingTag) => currentCallbackTags.push(trailingTag);
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "generics": {
          // A bare `@generics Name` (no `{constraint}`) falls back to the name
          // itself, mirroring `@template`'s unconstrained-parameter fallback.
          const constraint = type || name;
          for (const genericName of splitTopLevelCommas(name)) {
            warnAndTrackGenericName(genericName.trim(), sourceRangeFromCommentTag(ctx, tagSource));
          }
          usedGenericsTag = true;
          warnMixedGenericsTags();
          accumulateOrReplaceGeneric(name, constraint);
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "template": {
          // Build constraint from standard JSDoc @template syntax:
          //   @template T              → type="", name="T", default=undefined
          //   @template {string} T     → type="string", name="T", default=undefined
          //   @template [T=string]     → type="", name="T", default="string"
          //   @template {Foo} [T=Foo]  → type="Foo", name="T", default="Foo"
          const constraint = templateTagConstraint(name, type, defaultValue);

          if (blockHasSlotOrSnippetTag && !blockHasExtendsTag) {
            ctx.deferredSlotBlockGenerics.push({ name, constraint });
            break;
          }

          // Standard JSDoc usage: this `@template` types the function's own generic
          // parameter, not the component's - leave it out of the component's generics.
          if (blockDocumentsFunction) break;

          warnAndTrackGenericName(name, sourceRangeFromCommentTag(ctx, tagSource));
          usedTemplateTag = true;
          warnMixedGenericsTags();
          accumulateOrReplaceGeneric(name, constraint);
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "deprecated": {
          const deprecatedValue = deprecatedValueFromParts(name, description);
          if (currentEventName === undefined) {
            pendingDeprecated ??= deprecatedValue;
          } else {
            currentEventDeprecated ??= deprecatedValue;
          }
          break;
        }
        case "ignore":
        case "internal": {
          if (currentEventName === undefined) {
            pendingInternal = true;
          } else {
            currentEventInternal = true;
          }
          break;
        }
        case "sveld-ignore":
          if (currentEventName !== undefined) {
            currentEventIgnores.push(name);
          }
          break;
        case "enum":
        case "class":
        case "implements":
        case "this":
        case "namespace":
        case "memberof":
        case "module":
        case "file":
        case "overview":
          break;
        default:
          {
            const passthroughTag = {
              name: tag,
              body: raw,
            };
            if (!IDE_PASSTHROUGH_TAGS.has(tag) && !OTHER_KNOWN_JSDOC_TAGS.has(tag)) {
              recordDiagnostic(
                ctx,
                "jsdoc-unknown-tag",
                tag,
                `Unknown JSDoc tag "@${tag}"; passed through unchanged. If this is a typo, fix the tag name.`,
                sourceRangeFromCommentTag(ctx, tagSource),
              );
            }
            if (attachTrailingTag) {
              attachTrailingTag(passthroughTag);
            } else {
              pendingTags.push(passthroughTag);
            }
          }
          break;
      }
    }

    finalizeEvent();
    finalizeTypedef();
    finalizeCallback();

    if (blockHasStructuralTag && pendingTags.length > 0) {
      for (const danglingTag of pendingTags) {
        recordDiagnostic(
          ctx,
          "jsdoc-tag-dropped",
          danglingTag.name,
          `@${danglingTag.name} could not attach to a @slot/@snippet/@event/@typedef/@callback tag in the same comment block and was dropped.`,
        );
      }
      pendingTags.length = 0;
    }
  }
}
