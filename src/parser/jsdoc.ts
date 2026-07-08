import { parse as parseComment } from "comment-parser";
import type ComponentParser from "../ComponentParser";
import type {
  ComponentPropBinding,
  ComponentPropParam,
  DeprecatedValue,
  JsDocPassthroughTag,
  SourceRange,
} from "../ComponentParser";
import type { ParserContext } from "./context";
import { addDispatchedEvent, buildEventDetailFromProperties } from "./events";
import { splitTopLevelCommas } from "./generics";
import { addSlot } from "./slots";
import { sourceRangeFromCommentTag } from "./source-position";

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

/** True when a slice between an AST comment end and a node start is only whitespace. */
const ONLY_WHITESPACE_REGEX = /^\s*$/;

/** Trailing semicolon on a typedef source slice before brace matching. */
const TRAILING_SEMICOLON_REGEX = /;$/;

/** Strip a leading `-` from inline `@slot` / `@snippet` descriptions. */
const DESCRIPTION_DASH_PREFIX_REGEX = /^-\s*/;

function cleanDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const cleaned = description.replace(DESCRIPTION_DASH_PREFIX_REGEX, "").trim();
  return cleaned === "" ? "" : cleaned;
}

/**
 * Returns the description text that appears on the same line as the tag itself,
 * ignoring continuation lines that `comment-parser` aggregated into the tag's
 * `description` field. Continuation lines belong to the next tag (or the
 * enclosing event/typedef) and must not pollute the tag's own JSDoc.
 */
function getInlineTagDescription(tagSource: { tokens: { description?: string } }[] | undefined): string | undefined {
  if (!tagSource || tagSource.length === 0) return undefined;
  return tagSource[0].tokens.description;
}

/** `@since` and `@example` are kept out of prose descriptions and exposed as `tags` instead. */
const IDE_PASSTHROUGH_TAGS = new Set(["since", "example"]);

type JsDocSourceTokens = {
  tag?: string;
  name?: string;
  postName?: string;
  description?: string;
  postDelimiter?: string;
  end?: string;
};

/** Rebuilds a tag body from `comment-parser` source lines (needed for multi-line `@example`). */
function getPassthroughTagBodyFromSource(tagSource: Array<{ tokens: JsDocSourceTokens }> | undefined): string {
  if (!tagSource || tagSource.length === 0) return "";
  const parts: string[] = [];
  for (const line of tagSource) {
    const t = line.tokens;
    if ((t.end ?? "").trim() === "*/") break;
    if (t.tag) {
      const inline = `${t.name ?? ""}${t.postName ?? ""}${t.description ?? ""}`.trimEnd();
      if (inline) parts.push(inline);
    } else {
      parts.push(`${t.postDelimiter ?? ""}${t.description ?? ""}`);
    }
  }
  return parts.join("\n");
}

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

/** Returns `value`, or `undefined` when it's `undefined` or the empty string. */
function assignValue(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}

export function formatComment(comment: string) {
  let formatted_comment = comment;

  if (!formatted_comment.startsWith("/*")) {
    formatted_comment = `/*${formatted_comment}`;
  }

  if (!formatted_comment.endsWith("*/")) {
    formatted_comment += "*/";
  }

  return formatted_comment;
}

/** Split JSDoc tags into type/param/returns/passthrough buckets. */
export function getCommentTags(parsed: ReturnType<typeof parseComment>) {
  const tags = parsed[0]?.tags ?? [];
  const excludedTags = new Set([
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
  ]);

  let typeTag: (typeof tags)[number] | undefined;
  const paramTags: typeof tags = [];
  let returnsTag: (typeof tags)[number] | undefined;
  let binding: ComponentPropBinding | undefined;
  let deprecated: DeprecatedValue | undefined;
  const additionalTags: typeof tags = [];
  const passthroughTags: typeof tags = [];

  for (const tag of tags) {
    if (tag.tag === "type") {
      typeTag = tag;
    } else if (tag.tag === "param") {
      paramTags.push(tag);
    } else if (tag.tag === "returns" || tag.tag === "return") {
      returnsTag = tag;
    } else if (tag.tag === "deprecated") {
      deprecated ??= deprecatedValueFromParts(tag.name, tag.description);
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
    } else if (!excludedTags.has(tag.tag)) {
      additionalTags.push(tag);
    }
  }

  return {
    type: typeTag,
    param: paramTags,
    returns: returnsTag,
    binding,
    deprecated,
    additional: additionalTags,
    passthrough: passthroughTags,
    description: parsed[0]?.description,
  };
}

/** Last leading comment (JSDoc when present). TypeScript directives are stripped first. */
export function findJSDocComment(leadingComments: unknown[]): { value: string } | undefined {
  if (!leadingComments || leadingComments.length === 0) return undefined;
  const comment = leadingComments[leadingComments.length - 1];
  return comment && typeof comment === "object" && "value" in comment ? (comment as { value: string }) : undefined;
}

export function findAdjacentJSDocComment(
  ctx: ParserContext,
  leadingComments: unknown[] | undefined,
  nodeStart: number | undefined,
): { value: string } | undefined {
  if (!leadingComments || leadingComments.length === 0 || nodeStart === undefined || !ctx.source) return undefined;

  for (let index = leadingComments.length - 1; index >= 0; index--) {
    const comment = leadingComments[index];
    if (!comment || typeof comment !== "object" || !("value" in comment) || !("end" in comment)) continue;
    if (typeof comment.end !== "number") continue;

    const between = ctx.source.slice(comment.end, nodeStart);
    if (ONLY_WHITESPACE_REGEX.test(between)) {
      return comment as { value: string };
    }
  }

  return undefined;
}

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

  return processJSDocComment(parser, [jsdoc_comment]);
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

/** Parse adjacent JSDoc into type, params, returns, description, and passthrough tags. */
export function processJSDocComment(
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
    }
  | undefined {
  if (!leadingComments) return undefined;

  const jsdoc_comment = findJSDocComment(leadingComments);
  if (!jsdoc_comment) return undefined;

  const comment = parseComment(formatComment(jsdoc_comment.value), {
    spacing: "preserve",
  });

  const {
    type: typeTag,
    param: paramTags,
    returns: returnsTag,
    binding,
    deprecated,
    additional: additionalTags,
    passthrough: passthroughTags,
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
        description: cleanDescription(tag.description),
        optional: tag.optional || false,
      }));
  }

  if (returnsTag) returnType = parser.aliasType(returnsTag.type);

  const formattedDescription = assignValue(commentDescription?.trim());
  if (formattedDescription || additionalTags.length > 0) {
    const descriptionParts: string[] = [];
    if (formattedDescription) {
      descriptionParts.push(formattedDescription);
    }
    for (const tag of additionalTags) {
      const tagStr = `@${tag.tag}${tag.name ? ` ${tag.name}` : ""}${tag.description ? ` ${tag.description}` : ""}`;
      descriptionParts.push(tagStr);
    }
    description = descriptionParts.join("\n");
  }

  const tags: JsDocPassthroughTag[] | undefined =
    passthroughTags.length > 0
      ? passthroughTags.map((tag) => ({
          name: tag.tag,
          body: getPassthroughTagBodyFromSource(tag.source),
        }))
      : undefined;

  return { type, params, returnType, description, binding, deprecated, tags };
}

/** Scan source JSDoc for events, typedefs, callbacks, slots, extends, and generics. */
export function parseCustomTypes(ctx: ParserContext, parser: ComponentParser) {
  if (!ctx.source) return;
  let commentSearchOffset = 0;
  for (const { tags, description: commentDescription, source: blockSource } of parseComment(ctx.source, {
    spacing: "preserve",
  })) {
    const blockText = blockSource.map((line) => line.source).join("\n");
    const blockStartOffset = ctx.source.indexOf(blockText, commentSearchOffset);
    const commentBlockStartOffset = blockStartOffset === -1 ? undefined : blockStartOffset;
    if (blockStartOffset !== -1) {
      commentSearchOffset = blockStartOffset + blockText.length;
    }

    let currentEventName: string | undefined;
    let currentEventType: string | undefined;
    let currentEventDescription: string | undefined;
    let currentEventDeprecated: DeprecatedValue | undefined;
    let currentEventSource: SourceRange | undefined;
    let currentEventTagLine: number | undefined;
    let currentEventTags: JsDocPassthroughTag[] = [];
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
    const typedefProperties: Array<{
      name: string;
      type: string;
      description?: string;
      optional?: boolean;
      default?: string;
    }> = [];

    let currentCallbackName: string | undefined;
    let currentCallbackDescription: string | undefined;
    const callbackParams: Array<{
      name: string;
      type: string;
      optional?: boolean;
    }> = [];
    let callbackReturnType: string | undefined;

    let commentDescriptionUsed = false;
    let isFirstTag = true;
    const pendingTags: JsDocPassthroughTag[] = [];
    /** `@deprecated` for the next `@slot` / `@snippet` in this block. */
    let pendingDeprecated: DeprecatedValue | undefined;

    const lineDescriptions = new Map<number, string>();
    const tagLineNumbers = new Set<number>();
    /** Lines already used as preceding-description for another tag. */
    const consumedDescriptionLines = new Set<number>();
    for (const tagInfo of tags) {
      if (tagInfo.source && tagInfo.source.length > 0) {
        tagLineNumbers.add(tagInfo.source[0].number);
      }
    }
    for (const line of blockSource) {
      if (!line.tokens.tag && line.tokens.description && line.tokens.description.trim() !== "}") {
        lineDescriptions.set(line.number, line.tokens.description);
      }
    }

    /** Description lines immediately above a tag (not continuation lines from `comment-parser`). */
    const getPrecedingDescription = (tagSource: typeof blockSource): string | undefined => {
      if (!tagSource || tagSource.length === 0) return undefined;
      const tagLineNumber = tagSource[0].number;

      const descLines: string[] = [];
      const claimedLineNums: number[] = [];
      let foundDescriptionBlock = false;

      for (let lineNum = tagLineNumber - 1; lineNum >= 1; lineNum--) {
        if (tagLineNumbers.has(lineNum)) {
          break;
        }

        const desc = lineDescriptions.get(lineNum);
        if (desc) {
          descLines.unshift(desc);
          claimedLineNums.unshift(lineNum);
          foundDescriptionBlock = true;
        } else if (foundDescriptionBlock) {
          const sourceLine = blockSource.find((l) => l.number === lineNum);
          const isBlank =
            !sourceLine ||
            (!sourceLine.tokens.tag && (!sourceLine.tokens.description || sourceLine.tokens.description.trim() === ""));
          if (!isBlank) {
            break;
          }
        }
      }
      if (descLines.length === 0) return undefined;
      for (const n of claimedLineNums) consumedDescriptionLines.add(n);
      return descLines.join("\n").trim();
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
            const tLine = t.source?.[0]?.number;
            if (typeof tLine !== "number") continue;
            if (tLine <= currentEventTagLine) continue;
            if (t.tag === "property" || t.tag === "type") continue;
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
          source: currentEventSource,
        });
        ctx.eventDescriptions.set(currentEventName, currentEventDescription);
        ctx.jsDocEventNames.add(currentEventName);
        ctx.jsDocEventSources.set(currentEventName, currentEventSource);
        eventProperties.length = 0;
        currentEventName = undefined;
        currentEventType = undefined;
        currentEventDescription = undefined;
        currentEventDeprecated = undefined;
        currentEventSource = undefined;
        currentEventTagLine = undefined;
        currentEventTags = [];
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

        ctx.typedefs.set(currentTypedefName, {
          type: typedefType,
          name: currentTypedefName,
          description: assignValue(currentTypedefDescription),
          ts: typedefTs,
        });

        typedefProperties.length = 0;
        currentTypedefName = undefined;
        currentTypedefType = undefined;
        currentTypedefDescription = undefined;
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

        ctx.typedefs.set(currentCallbackName, {
          type: callbackType,
          name: currentCallbackName,
          description: assignValue(currentCallbackDescription),
          ts: callbackTs,
        });

        callbackParams.length = 0;
        callbackReturnType = undefined;
        currentCallbackName = undefined;
        currentCallbackDescription = undefined;
      }
    };

    /**
     * `@template` with `@slot`/`@snippet` is slot prose only, unless `@extends`
     * is in the same block (then it parameterizes inherited props).
     */
    const blockHasSlotOrSnippetTag = tags.some((t) => t.tag === "slot" || t.tag === "snippet");
    const blockHasExtendsTag = tags.some((t) => t.tag === "extends" || t.tag === "extendProps");

    for (const { tag, type: tagType, name, description, optional, default: defaultValue, source: tagSource } of tags) {
      const type = parser.aliasType(tagType);
      const precedingDescription = getPrecedingDescription(tagSource);

      switch (tag) {
        case "extends":
        case "extendProps":
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
          const inlineSlotDesc = cleanDescription(getInlineTagDescription(tagSource));
          let slotDesc = inlineSlotDesc;
          if (!slotDesc && isFirstTag && !commentDescriptionUsed && commentDescription) {
            slotDesc = commentDescription;
            commentDescriptionUsed = true;
          }
          if (!slotDesc && pendingTags.length === 0) {
            slotDesc = precedingDescription;
          }
          if (isFirstTag) isFirstTag = false;
          addSlot(ctx, {
            slot_name: name,
            slot_props: type,
            slot_description: slotDesc || undefined,
            slot_deprecated: pendingDeprecated,
            slot_tags: pendingTags.length > 0 ? [...pendingTags] : undefined,
            source: sourceRangeFromCommentTag(ctx, blockSource, tagSource, commentBlockStartOffset),
          });
          pendingTags.length = 0;
          pendingDeprecated = undefined;
          break;
        }
        case "event": {
          finalizeEvent();

          currentEventName = name;
          currentEventType = type;
          currentEventTagLine = tagSource && tagSource.length > 0 ? tagSource[0].number : undefined;
          const inlineEventDesc = cleanDescription(getInlineTagDescription(tagSource));
          currentEventDescription = inlineEventDesc || precedingDescription;
          if (!currentEventDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentEventDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          currentEventSource = sourceRangeFromCommentTag(ctx, blockSource, tagSource, commentBlockStartOffset);
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
            description: cleanDescription(getInlineTagDescription(tagSource)),
            optional: optional || false,
            default: defaultValue,
          };

          if (currentEventName !== undefined) {
            eventProperties.push(propertyData);
          } else if (currentTypedefName !== undefined) {
            typedefProperties.push(propertyData);
          }
          break;
        }
        case "typedef": {
          finalizeTypedef();

          currentTypedefName = normalizeGenericNameSpacing(name);
          currentTypedefType = type;
          const inlineTypedefDesc = cleanDescription(getInlineTagDescription(tagSource));
          currentTypedefDescription = inlineTypedefDesc || precedingDescription;
          if (!currentTypedefDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentTypedefDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "callback": {
          finalizeCallback();

          currentCallbackName = normalizeGenericNameSpacing(name);
          const inlineCallbackDesc = cleanDescription(getInlineTagDescription(tagSource));
          currentCallbackDescription = inlineCallbackDesc || precedingDescription;
          if (!currentCallbackDescription && isFirstTag && !commentDescriptionUsed && commentDescription) {
            currentCallbackDescription = commentDescription;
            commentDescriptionUsed = true;
          }
          if (isFirstTag) isFirstTag = false;
          break;
        }
        case "generics":
          ctx.generics = [name, type];
          if (isFirstTag) isFirstTag = false;
          break;
        case "template": {
          // Build constraint from standard JSDoc @template syntax:
          //   @template T              → type="", name="T", default=undefined
          //   @template {string} T     → type="string", name="T", default=undefined
          //   @template [T=string]     → type="", name="T", default="string"
          //   @template {Foo} [T=Foo]  → type="Foo", name="T", default="Foo"
          let constraint = name;
          if (type) constraint = `${name} extends ${type}`;
          if (defaultValue) constraint += ` = ${defaultValue}`;

          if (blockHasSlotOrSnippetTag && !blockHasExtendsTag) {
            ctx.deferredSlotBlockGenerics.push({ name, constraint });
            break;
          }

          parser.accumulateGeneric(name, constraint);
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
              body: getPassthroughTagBodyFromSource(tagSource),
            };
            if (currentEventName !== undefined && IDE_PASSTHROUGH_TAGS.has(tag)) {
              currentEventTags.push(passthroughTag);
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
  }
}
