/**
 * Component-level JSDoc tags (`@event`, `@slot`, `@typedef`, `@generics`, ...): anywhere in a
 * component's comments, they describe the component, not the declaration they sit on.
 */
import { closestMatch } from "../levenshtein";
import type { DeprecatedValue, JsDocPassthroughTag, SourceRange, TypeDef } from "../model";
import { indexOfClosingBracket, splitTopLevel } from "../type-text";
import type { JSDocComment, JSDocTag } from "./comment-parser";
import { parseComments, togglesCodeFence } from "./comment-parser";
import type { ParserContext } from "./context";
import { recordDiagnostic, recordSveldIgnore } from "./diagnostics";
import { addDispatchedEvent, buildEventDetailFromProperties } from "./events";
import { accumulateGeneric } from "./generics";
import {
  aliasType,
  cleanDescription,
  deprecatedValueFromBody,
  functionDocCommentStarts,
  IDE_PASSTHROUGH_TAGS,
  joinDescriptionLines,
  OTHER_KNOWN_JSDOC_TAGS,
  tagHeadIndex,
  templateTagParameters,
} from "./jsdoc";
import { parseObjectTypeLiteralMembers } from "./object-type-literal";
import { addSlot } from "./slots";
import { sourceRangeFromCommentTag } from "./source-position";
import { formatParamList } from "./utils";

const GENERIC_DEFAULT_EQUALS_REGEX = /\s*=\s*/;

/** `Name<Row=DataTableRow,Header=Foo>` to `Name<Row = DataTableRow, Header = Foo>`, as sveld spaces other generics. */
function normalizeGenericNameSpacing(name: string): string {
  const openIndex = name.indexOf("<");
  if (openIndex === -1 || !name.endsWith(">")) return name;

  const base = name.slice(0, openIndex);
  const params = name.slice(openIndex + 1, -1);
  const normalizedParams = splitTopLevel(params, ",")
    .map((param) => param.trim().replace(GENERIC_DEFAULT_EQUALS_REGEX, " = "))
    .join(", ");

  return `${base}<${normalizedParams}>`;
}

/** Tags that take the description lines directly above them when they have none on their own line. */
const PRECEDING_DESCRIPTION_TAGS = new Set(["restProps", "slot", "snippet", "event", "typedef", "callback"]);

/** Tags that stay inside the preceding `@event`'s scope instead of ending it. */
const EVENT_SCOPE_TAGS = new Set(["property", "type"]);

/** Tags that declare something of their own, closing the preceding `@event`'s scope. */
const EVENT_SCOPE_ENDING_TAGS = new Set(["slot", "snippet", "typedef", "callback"]);

/**
 * Text on the tag's own line, without the continuation lines `parseComments` folds into
 * `description`. A multi-line `{type}` moves that line down to where the type closes.
 */
function getInlineTagDescription(
  tagLines: Array<{ content: string; continuesType?: true }> | undefined,
): string | undefined {
  if (!tagLines || tagLines.length === 0) return undefined;
  return tagLines[tagHeadIndex(tagLines)].content;
}

/** A block line with no text, not part of a tag's opening line or its multi-line `{type}`. */
function isBlankLine(line: { tag?: string; continuesType?: true; content: string } | undefined): boolean {
  return !line || (!line.tag && !line.continuesType && line.content.trim() === "");
}

/** Whether a tag has body text on its own line (`@since 1.0`), not only below it (`@example`). */
function hasBodyOnTagLine(tag: JSDocTag): boolean {
  // `text` leaves out an empty tag line, so then it has one line fewer than the tag.
  return tag.text.split("\n").length === tag.lines.length;
}

function dropLastLines(text: string, count: number): string {
  if (count <= 0) return text;
  return text.split("\n").slice(0, -count).join("\n").trimEnd();
}

/**
 * Standard JSDoc/TSDoc tags sveld passes through: close enough to a sveld
 * tag to look like a typo (`@todo`/`@type`, `@prop`/`@param`), but meant.
 */
const STANDARD_JSDOC_TAGS = new Set([
  "abstract",
  "access",
  "alias",
  "alpha",
  "arg",
  "argument",
  "async",
  "augments",
  "author",
  "beta",
  "borrows",
  "const",
  "constructs",
  "copyright",
  "defaultValue",
  "description",
  "emits",
  "experimental",
  "exports",
  "external",
  "fires",
  "function",
  "global",
  "import",
  "inner",
  "instance",
  "kind",
  "lends",
  "license",
  "link",
  "listens",
  "member",
  "name",
  "override",
  "package",
  "private",
  "prop",
  "protected",
  "public",
  "readonly",
  "remarks",
  "requires",
  "satisfies",
  "sealed",
  "static",
  "summary",
  "throws",
  "todo",
  "tutorial",
  "typeParam",
  "version",
  "virtual",
  "yields",
]);

/** Tags a `jsdoc-unknown-tag` typo (`@typ`, `@evnet`) is matched against for a suggestion. */
const SUGGESTED_JSDOC_TAGS = [
  ...IDE_PASSTHROUGH_TAGS,
  ...OTHER_KNOWN_JSDOC_TAGS,
  "type",
  "param",
  "returns",
  "typedef",
  "property",
  "callback",
  "template",
  "generics",
  "slot",
  "snippet",
  "event",
  "restProps",
  "extends",
  "extendProps",
  "deprecated",
  "ignore",
  "internal",
  "sveld-ignore",
  "csspart",
  "cssprop",
];

const TRAILING_SEMICOLON_REGEX = /;$/;

/**
 * True when `source` is one balanced `{...}` (optional trailing `;`).
 * Unions like `{...} | {...}` must stay `type` aliases, not `interface`.
 */
function isSingleObjectLiteral(source: string): boolean {
  const s = source.trim().replace(TRAILING_SEMICOLON_REGEX, "").trimEnd();
  if (!s.startsWith("{") || !s.endsWith("}")) return false;
  return indexOfClosingBracket(s, 0) === s.length - 1;
}

const IDENTIFIER_REGEX = /[\w$]+/g;

/** Tags whose types make up the body of the `@typedef`/`@callback` above them. */
const TYPE_DECLARATION_BODY_TAGS = new Set(["property", "param", "returns", "return"]);

/**
 * Whether the `@typedef`/`@callback` at `ownerIndex` refers to any of `parameters` in its own
 * type or in the `@property`/`@param`/`@returns` types right below it.
 */
function typeDeclarationUsesAny(
  tags: readonly JSDocTag[],
  ownerIndex: number,
  parameters: ReadonlyArray<{ name: string }>,
): boolean {
  const bodyTypes = [tags[ownerIndex].type];
  for (let index = ownerIndex + 1; TYPE_DECLARATION_BODY_TAGS.has(tags[index]?.tag); index++) {
    bodyTypes.push(tags[index].type);
  }
  const identifiers = new Set(bodyTypes.join(" ").match(IDENTIFIER_REGEX));
  return parameters.some(({ name }) => identifiers.has(name));
}

/**
 * Whether `@property` tags below a `@typedef` of this type describe its members. As in
 * TypeScript, only an untyped or `object`/`Object` typedef takes them; a `@property` under
 * `@typedef {string | Fn} Name` is ignored rather than turning it into an object type.
 */
function typedefTakesProperties(typedefType: string | undefined): boolean {
  const type = typedefType?.trim();
  return !type || type === "object" || type === "Object";
}

/** Spans all of a component's comment blocks, for the duplicate/mixed generics warnings. */
interface GenericsTagState {
  usedGenericsTag: boolean;
  usedTemplateTag: boolean;
  warnedMixedGenericsTags: boolean;
  readonly seenGenericNames: Set<string>;
}

function warnMixedGenericsTags(ctx: ParserContext, state: GenericsTagState) {
  if (state.usedGenericsTag && state.usedTemplateTag && !state.warnedMixedGenericsTags) {
    state.warnedMixedGenericsTags = true;
    const location = ctx.componentFilePath ? ` in ${ctx.componentFilePath}` : "";
    console.warn(
      `Warning: Both @generics and @template tags are used to declare component generics${location}; their declarations are combined in the order encountered.`,
    );
  }
}

function warnAndTrackGenericName(
  ctx: ParserContext,
  state: GenericsTagState,
  genericName: string,
  source: SourceRange | undefined,
) {
  if (state.seenGenericNames.has(genericName)) {
    recordDiagnostic(ctx, "generics-conflict", genericName, `Duplicate generic name "${genericName}".`, source);
  } else {
    state.seenGenericNames.add(genericName);
  }
}

/** Redeclaring a generic (e.g. via both tags) updates its constraint instead of adding an invalid duplicate. */
function accumulateOrReplaceGeneric(ctx: ParserContext, declaredName: string, constraint: string) {
  if (ctx.generics) {
    const names = splitTopLevel(ctx.generics[0], ",").map((n) => n.trim());
    const existingIndex = names.indexOf(declaredName.trim());
    if (existingIndex !== -1) {
      const constraints = splitTopLevel(ctx.generics[1], ",").map((c) => c.trim());
      constraints[existingIndex] = constraint;
      ctx.generics = [ctx.generics[0], constraints.join(", ")];
      return;
    }
  }
  accumulateGeneric(ctx, declaredName, constraint);
}

/** `@typedef` and `@callback` share `ctx.typedefs`, so either one can overwrite the other. */
function addTypedef(
  ctx: ParserContext,
  {
    name,
    type,
    ts,
    description,
    tags,
    internal,
    source,
  }: Omit<TypeDef, "tags" | "internal"> & {
    tags: JsDocPassthroughTag[];
    internal: boolean;
  },
) {
  if (ctx.typedefs.has(name)) {
    recordDiagnostic(
      ctx,
      "typedef-duplicate",
      name,
      `Duplicate typedef/callback name "${name}"; the later declaration overwrites the earlier one.`,
      source,
    );
  }
  ctx.typedefs.set(name, {
    type,
    name,
    description: description || undefined,
    ts,
    tags: tags.length > 0 ? tags : undefined,
    ...(internal ? { internal: true as const } : {}),
    source,
  });
}

/** Two properties with the same key would otherwise both appear in the emitted object type. */
function pushOrReplaceProperty<T extends { name: string }>(
  ctx: ParserContext,
  list: T[],
  property: T,
  ownerName: string | undefined,
  source: SourceRange | undefined,
) {
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
}

type BlockLines = JSDocTag["lines"];

/** A `@property` of an `@event` detail or an object `@typedef`. */
interface TagProperty {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  default?: string;
}

/**
 * Reads one comment block's tags in order. Tags build on each other (an `@event` collects
 * the `@property` tags below it, a tag with no description takes the text above it), so the
 * in-progress event/typedef/callback and the claimed description lines live here.
 */
class CommentBlockReader {
  private readonly tags: JSDocTag[];
  private readonly lines: BlockLines;
  /** The block's leading description, which the first structural tag takes when it has none of its own. */
  private readonly commentDescription: string;
  private commentDescriptionUsed = false;
  private isFirstTag = true;

  private eventName: string | undefined;
  private eventType: string | undefined;
  private eventDescription: string | undefined;
  private eventDeprecated: DeprecatedValue | undefined;
  private eventInternal = false;
  private eventSource: SourceRange | undefined;
  private eventTagLine: number | undefined;
  private eventTags: JsDocPassthroughTag[] = [];
  private eventIgnores: string[] = [];
  private readonly eventProperties: TagProperty[] = [];

  private typedefName: string | undefined;
  private typedefType: string | undefined;
  private typedefDescription: string | undefined;
  private typedefSource: SourceRange | undefined;
  private typedefTags: JsDocPassthroughTag[] = [];
  private typedefInternal = false;
  private readonly typedefProperties: TagProperty[] = [];

  private callbackName: string | undefined;
  private callbackDescription: string | undefined;
  private callbackSource: SourceRange | undefined;
  private callbackTags: JsDocPassthroughTag[] = [];
  private callbackInternal = false;
  private readonly callbackParams: Array<{ name: string; type: string; optional?: boolean }> = [];
  private callbackReturnType: string | undefined;

  /**
   * Set whenever a structural tag (`@slot`/`@event`/`@typedef`/...) starts, so a passthrough
   * tag (`@since`, `@see`, ...) after it attaches to it instead of queuing in `pendingTags`
   * for the next structural tag.
   */
  private attachTrailingTag: ((tag: JsDocPassthroughTag) => void) | undefined;
  private readonly pendingTags: JsDocPassthroughTag[] = [];
  /** `@deprecated` for the next `@slot` / `@snippet` in this block. */
  private pendingDeprecated: DeprecatedValue | undefined;
  /** `@ignore`/`@internal` for the next `@slot`/`@snippet`/`@typedef`/`@callback` in this block. */
  private pendingInternal = false;
  /** `@template` type parameters for the `@typedef`/`@callback` right below them. */
  private readonly pendingTypeParameters: string[] = [];

  private readonly lineDescriptions = new Map<number, string>();
  private readonly tagLineNumbers = new Set<number>();
  private readonly consumedDescriptionLines = new Set<number>();
  /**
   * Indented lines directly under a tag's line: that tag's wrapped description, never the
   * description of the tag after it. Unindented text between two tags stays ambiguous and
   * keeps the description-above-the-tag reading.
   */
  private readonly indentedContinuationLines = new Set<number>();
  /**
   * Cuts the body of the tag above the current one short at the first line the current tag
   * claims as its description, so the text isn't in both. `trimThisBody` is handed to the next tag.
   */
  private trimBodyAbove: ((fromLine: number) => void) | undefined;
  private trimThisBody: ((fromLine: number) => void) | undefined;

  /**
   * `@template` with `@slot`/`@snippet` is slot prose only, unless `@extends`
   * is in the same block (then it parameterizes inherited props).
   */
  private readonly hasSlotOrSnippetTag: boolean;
  private readonly hasExtendsTag: boolean;

  private readonly ctx: ParserContext;
  private readonly generics: GenericsTagState;
  /** The block documents an ordinary function, so its `@template`s are that function's. */
  private readonly documentsFunction: boolean;

  constructor(ctx: ParserContext, generics: GenericsTagState, block: JSDocComment, documentsFunction: boolean) {
    this.ctx = ctx;
    this.generics = generics;
    this.documentsFunction = documentsFunction;
    const { tags, lines: blockLines } = block;
    this.tags = tags;
    this.lines = blockLines;
    this.commentDescription = block.description;
    this.hasSlotOrSnippetTag = tags.some((t) => t.tag === "slot" || t.tag === "snippet");
    this.hasExtendsTag = tags.some((t) => t.tag === "extends" || t.tag === "extendProps");

    for (const tagInfo of tags) {
      if (tagInfo.lines.length > 0) {
        this.tagLineNumbers.add(tagInfo.lines[0].number);
      }
    }
    // A multi-line `{type}`'s lines, including the one where it closes, belong to the tag's
    // opening line: their text is the tag's inline description, never a continuation line.
    for (const line of blockLines) {
      if (line.continuesType) this.tagLineNumbers.add(line.number);
    }
    let inIndentedContinuation = false;
    let inCodeFence = false;
    for (const line of blockLines) {
      // A lone "}" outside a code fence is the tail of a multi-line `{...}` type, not prose.
      if (!line.tag && !line.continuesType && line.content && (inCodeFence || line.content.trim() !== "}")) {
        this.lineDescriptions.set(line.number, line.content);
      }
      if (line.tag !== undefined || line.continuesType) {
        inIndentedContinuation = true;
      } else if (!line.content.trim()) {
        // A blank line between paragraphs doesn't end an indented continuation.
      } else if (inIndentedContinuation && (line.indent || inCodeFence)) {
        // A code fence opened in an indented continuation runs to its closing line.
        this.indentedContinuationLines.add(line.number);
      } else {
        inIndentedContinuation = false;
      }
      if (togglesCodeFence(line.content)) inCodeFence = !inCodeFence;
    }
  }

  /** Falls back to the block's leading description for the block's first structural tag. */
  private orCommentDescription(description: string | undefined): string | undefined {
    if (description || !this.isFirstTag || this.commentDescriptionUsed || !this.commentDescription) return description;
    this.commentDescriptionUsed = true;
    return this.commentDescription;
  }

  /** A `@typedef`/`@callback` name, taking any `@template`s right above it as its type parameters. */
  private typeDeclarationName(name: string): string {
    if (this.pendingTypeParameters.length === 0) return normalizeGenericNameSpacing(name);
    const declared = `${name}<${this.pendingTypeParameters.join(", ")}>`;
    this.pendingTypeParameters.length = 0;
    return declared;
  }

  /**
   * Joins block lines `lineNums` (ascending) after `head` (the tag line's text). Blank lines
   * between two of them stay a paragraph break when nothing else sits in between.
   */
  private joinBlockLines(lineNums: readonly number[], head?: { text: string; line: number }): string {
    const texts = head ? head.text.split("\n") : [];
    let previous = head?.line;
    for (const lineNum of lineNums) {
      if (previous !== undefined && lineNum - previous > 1) {
        let gap = previous + 1;
        while (gap < lineNum && isBlankLine(this.lines[gap])) gap++;
        if (gap === lineNum) for (let n = previous + 1; n < lineNum; n++) texts.push("");
      }
      const line = this.lines[lineNum];
      texts.push(line.indent + line.content);
      previous = lineNum;
    }
    return joinDescriptionLines(texts);
  }

  /** Description lines immediately above a tag (not continuation lines the tag's own body absorbed). */
  private getPrecedingDescription(tagSource: BlockLines): string | undefined {
    if (tagSource.length === 0) return undefined;
    const tagLineNumber = tagSource[0].number;

    const claimedLineNums: number[] = [];
    let foundDescriptionBlock = false;

    for (let lineNum = tagLineNumber - 1; lineNum >= 0; lineNum--) {
      if (
        this.tagLineNumbers.has(lineNum) ||
        this.indentedContinuationLines.has(lineNum) ||
        this.consumedDescriptionLines.has(lineNum)
      ) {
        break;
      }

      if (this.lineDescriptions.has(lineNum)) {
        claimedLineNums.unshift(lineNum);
        foundDescriptionBlock = true;
      } else if (foundDescriptionBlock && !isBlankLine(this.lines[lineNum])) {
        break;
      }
    }
    if (claimedLineNums.length === 0) return undefined;
    for (const n of claimedLineNums) this.consumedDescriptionLines.add(n);
    this.trimBodyAbove?.(claimedLineNums[0]);
    return this.joinBlockLines(claimedLineNums);
  }

  /**
   * Keeps a prose tag's body and the next tag's description apart. A tag with nothing on its
   * own line (`@example` above a code fence) owns every line below it; one with text there
   * gives up its trailing lines when the next tag claims them, dropping them via `trim`.
   */
  private claimBodyLines(tagInfo: JSDocTag, trim: (droppedLineCount: number) => void) {
    if (!hasBodyOnTagLine(tagInfo)) {
      for (let index = 1; index < tagInfo.lines.length; index++) {
        this.consumedDescriptionLines.add(tagInfo.lines[index].number);
      }
      return;
    }
    const lastLine = tagInfo.lines[tagInfo.lines.length - 1].number;
    this.trimThisBody = (fromLine) => trim(lastLine - fromLine + 1);
  }

  /**
   * A tag's line plus its continuation lines, which run to the next tag as in JSDoc. Unindented
   * lines are left for the next tag when it takes the text above it (see
   * {@link PRECEDING_DESCRIPTION_TAGS}), and for the event when this tag ends an `@event`'s scope.
   */
  private getTagDescription(tagSource: BlockLines, nextTag: JSDocTag | undefined, inEventScope = false) {
    const inline = cleanDescription(getInlineTagDescription(tagSource));
    const nextTagTakesTextAbove =
      nextTag !== undefined &&
      PRECEDING_DESCRIPTION_TAGS.has(nextTag.tag) &&
      !cleanDescription(getInlineTagDescription(nextTag.lines));
    const endsEventScope = inEventScope && (nextTag === undefined || !EVENT_SCOPE_TAGS.has(nextTag.tag));

    const continuation: number[] = [];
    for (let index = 1; index < tagSource.length; index++) {
      const line = tagSource[index];
      if ((nextTagTakesTextAbove || endsEventScope) && !this.indentedContinuationLines.has(line.number)) continue;
      if (!this.lineDescriptions.get(line.number)?.trim() || this.consumedDescriptionLines.has(line.number)) continue;
      continuation.push(line.number);
      this.consumedDescriptionLines.add(line.number);
    }
    if (continuation.length === 0) return inline;
    return this.joinBlockLines(continuation, { text: inline ?? "", line: tagSource[tagHeadIndex(tagSource)].number });
  }

  /**
   * Unindented text after an `@event`'s scope describes the tag below it. When that leaves the
   * event with no description, the author likely meant it for the event, so flag it.
   */
  private flagDescriptionAfterEvent(
    tag: string,
    name: string,
    tagSource: BlockLines,
    previousTag: JSDocTag | undefined,
  ) {
    if (this.eventName === undefined || this.eventDescription) return;
    // Indented lines under the `@event` are its description; they're merged in later.
    if (this.eventTagLine !== undefined && this.indentedContinuationLines.has(this.eventTagLine + 1)) return;
    if (previousTag?.tag !== "event" && !EVENT_SCOPE_TAGS.has(previousTag?.tag ?? "")) return;
    if (cleanDescription(getInlineTagDescription(tagSource))) return;
    const label = name ? `@${tag} "${name}"` : `@${tag}`;
    recordDiagnostic(
      this.ctx,
      "event-description-ambiguous",
      this.eventName,
      `Text after @event "${this.eventName}" was used as the description of ${label}. Move it above the tag it describes, indent it as a continuation line, or give each event its own comment block.`,
      sourceRangeFromCommentTag(this.ctx, tagSource),
    );
  }

  /**
   * The text above `tags[tagIndex]`. Only a tag that uses it claims it: otherwise it stays with
   * the tag above (e.g. an `@event`'s trailing text).
   */
  private takePrecedingDescription(tagIndex: number): string | undefined {
    const { tag, name, lines: tagSource } = this.tags[tagIndex];
    const preceding = this.getPrecedingDescription(tagSource);
    if (preceding) this.flagDescriptionAfterEvent(tag, name, tagSource, this.tags[tagIndex - 1]);
    return preceding;
  }

  private finalizeEvent() {
    if (this.eventName === undefined) return;
    const { ctx } = this;
    // Prefer explicit `@type` over `@property`-built objects; `{object}` falls through.
    const explicitType =
      this.eventType && this.eventType !== "object" && this.eventType !== "Object" ? this.eventType : undefined;
    const detailType =
      explicitType ??
      (this.eventProperties.length > 0
        ? buildEventDetailFromProperties(this.eventProperties, true)
        : this.eventType || "");

    const eventTagLine = this.eventTagLine;
    if (eventTagLine !== undefined) {
      const scopeBoundaryLine = this.tags.find((t) => {
        const line = t.lines[0]?.number;
        return line !== undefined && line > eventTagLine && !EVENT_SCOPE_TAGS.has(t.tag);
      })?.lines[0].number;
      const trailing = Array.from(this.lineDescriptions.keys())
        .sort((a, b) => a - b)
        .filter(
          (lineNum) =>
            lineNum > eventTagLine &&
            (scopeBoundaryLine === undefined || lineNum < scopeBoundaryLine) &&
            !this.consumedDescriptionLines.has(lineNum) &&
            this.lineDescriptions.get(lineNum)?.trim(),
        );
      for (const lineNum of trailing) this.consumedDescriptionLines.add(lineNum);
      if (trailing.length > 0) {
        this.eventDescription = this.joinBlockLines(
          trailing,
          this.eventDescription ? { text: this.eventDescription, line: eventTagLine } : undefined,
        );
      }
    }

    // With no `{type}` or `@property`, the `null` detail is only a fallback that a dispatch
    // replaces (see `addDispatchedEvent`), unless an earlier `@event` typed this one.
    const fallbackDetail =
      detailType === "" && (!ctx.events.has(this.eventName) || ctx.untypedJsDocEventNames.has(this.eventName));
    addDispatchedEvent(ctx, {
      name: this.eventName,
      detail: detailType,
      has_argument: false,
      description: this.eventDescription,
      deprecated: this.eventDeprecated,
      tags: this.eventTags.length > 0 ? this.eventTags : undefined,
      internal: this.eventInternal || undefined,
      source: this.eventSource,
    });
    if (fallbackDetail) ctx.untypedJsDocEventNames.add(this.eventName);
    ctx.eventDescriptions.set(this.eventName, this.eventDescription);
    ctx.jsDocEventNames.add(this.eventName);
    ctx.jsDocEventSources.set(this.eventName, this.eventSource);
    recordSveldIgnore(ctx, "event-no-source", this.eventName, this.eventIgnores);
    this.eventProperties.length = 0;
    this.eventName = undefined;
    this.eventType = undefined;
    this.eventDescription = undefined;
    this.eventDeprecated = undefined;
    this.eventInternal = false;
    this.eventSource = undefined;
    this.eventTagLine = undefined;
    this.eventTags = [];
    this.eventIgnores = [];
  }

  private finalizeTypedef() {
    if (this.typedefName === undefined) return;
    const { ctx } = this;
    const hasProperties = this.typedefProperties.length > 0;
    const typedefType = hasProperties
      ? buildEventDetailFromProperties(this.typedefProperties, true)
      : this.typedefType || "{}";
    const typedefTs =
      !hasProperties && this.typedefType && isSingleObjectLiteral(typedefType)
        ? `interface ${this.typedefName} ${typedefType}`
        : `type ${this.typedefName} = ${typedefType};`;

    const members = hasProperties
      ? this.typedefProperties
          .filter(({ name }) => !name.includes(".") && !name.startsWith("["))
          .map(({ name, type, optional, description }) => ({
            name,
            type,
            optional: optional === true,
            ...(description ? { description } : {}),
          }))
      : parseObjectTypeLiteralMembers(typedefType);
    if (members) ctx.typedefMembersByName.set(this.typedefName, members);

    addTypedef(ctx, {
      name: this.typedefName,
      type: typedefType,
      ts: typedefTs,
      description: this.typedefDescription,
      tags: this.typedefTags,
      internal: this.typedefInternal,
      source: this.typedefSource,
    });

    this.typedefProperties.length = 0;
    this.typedefName = undefined;
    this.typedefType = undefined;
    this.typedefDescription = undefined;
    this.typedefSource = undefined;
    this.typedefTags = [];
    this.typedefInternal = false;
  }

  private finalizeCallback() {
    if (this.callbackName === undefined) return;
    const callbackType = `(${formatParamList(this.callbackParams)}) => ${this.callbackReturnType || "void"}`;
    addTypedef(this.ctx, {
      name: this.callbackName,
      type: callbackType,
      ts: `type ${this.callbackName} = ${callbackType};`,
      description: this.callbackDescription,
      tags: this.callbackTags,
      internal: this.callbackInternal,
      source: this.callbackSource,
    });

    this.callbackParams.length = 0;
    this.callbackReturnType = undefined;
    this.callbackName = undefined;
    this.callbackDescription = undefined;
    this.callbackSource = undefined;
    this.callbackTags = [];
    this.callbackInternal = false;
  }

  private readExtends(tagIndex: number, type: string) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    if (this.ctx.extends !== undefined) {
      recordDiagnostic(
        this.ctx,
        "extend-props-duplicate",
        name,
        `A second @extends/@extendProps tag ("${name}") overwrote the first ("${this.ctx.extends.interface}"); only one is used.`,
        sourceRangeFromCommentTag(this.ctx, tagSource),
      );
    }
    this.ctx.extends = {
      interface: name,
      import: type,
    };
    this.isFirstTag = false;
  }

  private readRestProps(tagIndex: number, type: string) {
    const { name, description } = this.tags[tagIndex];
    const rawInlineDesc = name ? (description ? `${name} ${description}` : name) : description;
    const inlineRestPropsDesc = cleanDescription(rawInlineDesc);
    const restPropsDesc = this.orCommentDescription(inlineRestPropsDesc || this.takePrecedingDescription(tagIndex));
    const restProps: NonNullable<ParserContext["rest_props"]> = {
      type: "Element",
      name: type,
      description: restPropsDesc || undefined,
    };
    this.ctx.rest_props = restProps;
    if (inlineRestPropsDesc) {
      this.claimBodyLines(this.tags[tagIndex], (droppedLineCount) => {
        restProps.description = cleanDescription(dropLastLines(rawInlineDesc, droppedLineCount)) || undefined;
      });
    }
    this.isFirstTag = false;
  }

  private readSlot(tagIndex: number, type: string) {
    const { tag, name: rawName, lines: tagSource } = this.tags[tagIndex];
    // `@slot {Type} - description` describes the default slot.
    const name = rawName === "-" ? undefined : rawName;
    let slotDesc = this.orCommentDescription(this.getTagDescription(tagSource, this.tags[tagIndex + 1]));
    if (!slotDesc && this.pendingTags.length === 0) {
      slotDesc = this.takePrecedingDescription(tagIndex);
    }
    this.isFirstTag = false;
    const slotType = type || "Record<string, never>";
    if (!type) {
      recordDiagnostic(
        this.ctx,
        "slot-missing-type",
        name || "default",
        `@${tag}${name ? ` "${name}"` : ""} is missing a required {Type} annotation; falling back to "${slotType}".`,
        sourceRangeFromCommentTag(this.ctx, tagSource),
      );
    }
    const slotTags = this.pendingTags.splice(0);
    addSlot(this.ctx, {
      slot_name: name,
      slot_props: slotType,
      slot_description: slotDesc || undefined,
      slot_deprecated: this.pendingDeprecated,
      slot_tags: slotTags.length > 0 ? slotTags : undefined,
      slot_internal: this.pendingInternal || undefined,
      source: sourceRangeFromCommentTag(this.ctx, tagSource),
    });
    this.pendingDeprecated = undefined;
    this.pendingInternal = false;
    const slotKey = name === undefined || name === "" ? null : name;
    this.attachTrailingTag = (trailingTag) => {
      const slot = this.ctx.slots.get(slotKey);
      if (slot) slot.tags = [...(slot.tags ?? []), trailingTag];
    };
  }

  private readEvent(tagIndex: number, type: string) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    // Claim the text above before the previous event takes it as its trailing description.
    const eventDescription =
      cleanDescription(getInlineTagDescription(tagSource)) || this.takePrecedingDescription(tagIndex);
    this.finalizeEvent();

    this.eventName = name;
    this.eventType = type;
    this.eventTagLine = tagSource.length > 0 ? tagSource[0].number : undefined;
    this.eventDescription = this.orCommentDescription(eventDescription);
    this.eventSource = sourceRangeFromCommentTag(this.ctx, tagSource);
    this.eventTags.push(...this.pendingTags.splice(0));
    this.attachTrailingTag = (trailingTag) => this.eventTags.push(trailingTag);
    this.isFirstTag = false;
  }

  private readProperty(tagIndex: number, type: string) {
    const { name, optional, default: defaultValue, lines: tagSource } = this.tags[tagIndex];
    const propertyData = {
      name,
      type,
      description: this.getTagDescription(tagSource, this.tags[tagIndex + 1], this.eventName !== undefined),
      optional: optional || false,
      default: defaultValue,
    };

    if (this.eventName !== undefined) {
      pushOrReplaceProperty(
        this.ctx,
        this.eventProperties,
        propertyData,
        this.eventName,
        sourceRangeFromCommentTag(this.ctx, tagSource),
      );
    } else if (this.typedefName !== undefined && typedefTakesProperties(this.typedefType)) {
      pushOrReplaceProperty(
        this.ctx,
        this.typedefProperties,
        propertyData,
        this.typedefName,
        sourceRangeFromCommentTag(this.ctx, tagSource),
      );
    }
  }

  private readTypedef(tagIndex: number, type: string) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    this.finalizeTypedef();

    this.typedefName = this.typeDeclarationName(name);
    this.typedefType = type;
    this.typedefSource = sourceRangeFromCommentTag(this.ctx, tagSource);
    this.typedefDescription = this.orCommentDescription(
      this.getTagDescription(tagSource, this.tags[tagIndex + 1]) || this.takePrecedingDescription(tagIndex),
    );
    this.typedefTags.push(...this.pendingTags.splice(0));
    this.typedefInternal = this.pendingInternal;
    this.pendingInternal = false;
    this.attachTrailingTag = (trailingTag) => this.typedefTags.push(trailingTag);
    this.isFirstTag = false;
  }

  private readCallback(tagIndex: number) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    this.finalizeCallback();

    this.callbackName = this.typeDeclarationName(name);
    this.callbackSource = sourceRangeFromCommentTag(this.ctx, tagSource);
    this.callbackDescription = this.orCommentDescription(
      this.getTagDescription(tagSource, this.tags[tagIndex + 1]) || this.takePrecedingDescription(tagIndex),
    );
    this.callbackTags.push(...this.pendingTags.splice(0));
    this.callbackInternal = this.pendingInternal;
    this.pendingInternal = false;
    this.attachTrailingTag = (trailingTag) => this.callbackTags.push(trailingTag);
    this.isFirstTag = false;
  }

  private readGenerics(tagIndex: number, type: string) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    const source = sourceRangeFromCommentTag(this.ctx, tagSource);
    for (const genericName of splitTopLevel(name, ",")) {
      warnAndTrackGenericName(this.ctx, this.generics, genericName.trim(), source);
    }
    this.generics.usedGenericsTag = true;
    warnMixedGenericsTags(this.ctx, this.generics);
    // A bare `@generics Name` is unconstrained, like `@template Name`.
    accumulateOrReplaceGeneric(this.ctx, name, type || name);
    this.isFirstTag = false;
  }

  private readTemplate(tagIndex: number, type: string) {
    const { tags } = this;
    const parameters = templateTagParameters(tags[tagIndex], type);

    // Right above a `@typedef`/`@callback` without its own `<...>` that uses them, the
    // `@template`s parameterize that type (`type Box<T>`), as in TypeScript. Otherwise
    // (`@template {Node} [Node=Node]` above `@typedef {object} Node`) they stay component generics.
    let ownerIndex = tagIndex + 1;
    while (tags[ownerIndex]?.tag === "template") ownerIndex++;
    const owner = tags[ownerIndex];
    if (
      (owner?.tag === "typedef" || owner?.tag === "callback") &&
      !owner.name.includes("<") &&
      typeDeclarationUsesAny(tags, ownerIndex, parameters)
    ) {
      this.pendingTypeParameters.push(...parameters.map(({ constraint }) => constraint));
      return;
    }

    if (this.hasSlotOrSnippetTag && !this.hasExtendsTag) {
      this.ctx.deferredSlotBlockGenerics.push(...parameters);
      return;
    }

    // The function's own type parameter, not the component's.
    if (this.documentsFunction) return;

    const source = sourceRangeFromCommentTag(this.ctx, tags[tagIndex].lines);
    for (const parameter of parameters) {
      warnAndTrackGenericName(this.ctx, this.generics, parameter.name, source);
      accumulateOrReplaceGeneric(this.ctx, parameter.name, parameter.constraint);
    }
    this.generics.usedTemplateTag = true;
    warnMixedGenericsTags(this.ctx, this.generics);
    this.isFirstTag = false;
  }

  private readDeprecated(tagIndex: number) {
    const { text } = this.tags[tagIndex];
    const forEvent = this.eventName !== undefined;
    // The first `@deprecated` wins.
    if (forEvent ? this.eventDeprecated !== undefined : this.pendingDeprecated !== undefined) return;
    const setDeprecated = (value: DeprecatedValue) => {
      if (forEvent) this.eventDeprecated = value;
      else this.pendingDeprecated = value;
    };
    setDeprecated(deprecatedValueFromBody(text));
    this.claimBodyLines(this.tags[tagIndex], (droppedLineCount) => {
      setDeprecated(deprecatedValueFromBody(dropLastLines(text, droppedLineCount)));
    });
  }

  /** A tag sveld has no structure for: kept as-is on the structural tag it belongs to, and flagged if unknown. */
  private readPassthrough(tagIndex: number) {
    const { tag, text, lines: tagSource } = this.tags[tagIndex];
    const passthroughTag = { name: tag, body: text };
    this.claimBodyLines(this.tags[tagIndex], (droppedLineCount) => {
      passthroughTag.body = dropLastLines(text, droppedLineCount);
    });
    if (!IDE_PASSTHROUGH_TAGS.has(tag) && !OTHER_KNOWN_JSDOC_TAGS.has(tag)) {
      // One edit for a short tag name, two for a longer one: tag names are short.
      const suggestion = STANDARD_JSDOC_TAGS.has(tag)
        ? undefined
        : closestMatch(tag, SUGGESTED_JSDOC_TAGS, tag.length <= 4 ? 1 : 2);
      recordDiagnostic(
        this.ctx,
        "jsdoc-unknown-tag",
        tag,
        suggestion
          ? `Unknown JSDoc tag "@${tag}"; did you mean "@${suggestion}"? Passed through unchanged.`
          : `Unknown JSDoc tag "@${tag}"; passed through unchanged. If this is a typo, fix the tag name.`,
        sourceRangeFromCommentTag(this.ctx, tagSource),
      );
    }
    if (this.attachTrailingTag) {
      this.attachTrailingTag(passthroughTag);
    } else {
      this.pendingTags.push(passthroughTag);
    }
  }

  read() {
    const { tags } = this;
    for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
      const { tag, type: tagType, name, optional } = tags[tagIndex];
      const type = aliasType(tagType);
      this.trimBodyAbove = this.trimThisBody;
      this.trimThisBody = undefined;

      switch (tag) {
        case "extends":
        case "extendProps":
          this.readExtends(tagIndex, type);
          break;
        case "restProps":
          this.readRestProps(tagIndex, type);
          break;
        case "slot":
        case "snippet":
          this.readSlot(tagIndex, type);
          break;
        case "csspart": {
          const partDescription = this.getTagDescription(tags[tagIndex].lines, tags[tagIndex + 1]);
          this.ctx.cssParts.push({
            name,
            ...(partDescription ? { description: partDescription } : {}),
          });
          break;
        }
        case "cssprop":
        case "cssproperty": {
          const propertyDescription = this.getTagDescription(tags[tagIndex].lines, tags[tagIndex + 1]);
          const defaultValue = tags[tagIndex].default;
          this.ctx.cssProperties.push({
            name,
            ...(type ? { type } : {}),
            ...(defaultValue === undefined ? {} : { default: defaultValue }),
            ...(propertyDescription ? { description: propertyDescription } : {}),
          });
          break;
        }
        case "event":
          this.readEvent(tagIndex, type);
          break;
        case "type":
          if (this.eventName !== undefined) {
            this.eventType = type;
          }
          break;
        case "param":
          if (this.callbackName !== undefined) {
            this.callbackParams.push({ name, type, optional: optional || false });
          }
          break;
        case "returns":
        case "return":
          if (this.callbackName !== undefined) {
            this.callbackReturnType = type;
          }
          break;
        case "property":
          this.readProperty(tagIndex, type);
          break;
        case "typedef":
          this.readTypedef(tagIndex, type);
          break;
        case "callback":
          this.readCallback(tagIndex);
          break;
        case "generics":
          this.readGenerics(tagIndex, type);
          break;
        case "template":
          this.readTemplate(tagIndex, type);
          break;
        case "deprecated":
          this.readDeprecated(tagIndex);
          break;
        case "ignore":
        case "internal":
          if (this.eventName === undefined) {
            this.pendingInternal = true;
          } else {
            this.eventInternal = true;
          }
          break;
        case "sveld-ignore":
          if (this.eventName !== undefined) {
            this.eventIgnores.push(name);
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
          this.readPassthrough(tagIndex);
          break;
      }
      if (EVENT_SCOPE_ENDING_TAGS.has(tag)) this.finalizeEvent();
    }

    this.finalizeEvent();
    this.finalizeTypedef();
    this.finalizeCallback();

    // Leftover tags in a plain prop or context comment are expected: `processJSDocComment`
    // captures those. They're only dropped when the block had a structural tag to attach to.
    if (this.pendingTags.length === 0) return;
    const hasStructuralTag = tags.some((t) => t.tag === "event" || EVENT_SCOPE_ENDING_TAGS.has(t.tag));
    if (!hasStructuralTag) return;
    for (const danglingTag of this.pendingTags) {
      recordDiagnostic(
        this.ctx,
        "jsdoc-tag-dropped",
        danglingTag.name,
        `@${danglingTag.name} could not attach to a @slot/@snippet/@event/@typedef/@callback tag in the same comment block and was dropped.`,
      );
    }
  }
}

/** `scanSource` is the component source with its `<style>` blanked out. */
export function parseCustomTypes(ctx: ParserContext, scanSource: string | undefined = ctx.source) {
  if (!scanSource) return;
  const generics: GenericsTagState = {
    usedGenericsTag: false,
    usedTemplateTag: false,
    warnedMixedGenericsTags: false,
    seenGenericNames: new Set(),
  };
  // Only a `@template` tag reads this set, so skip the statement scan without one.
  const functionDocStarts = scanSource.includes("@template") ? functionDocCommentStarts(ctx) : new Set<number>();
  ctx.functionDocCommentStarts = functionDocStarts;
  const blocks = parseComments(scanSource);
  // Reused by leading-comment lookups in the main walk (see `parsedSourceBlock`).
  for (const block of blocks) ctx.jsDocBlocksByStart.set(block.start, block);
  for (const block of blocks) {
    new CommentBlockReader(ctx, generics, block, functionDocStarts.has(block.start)).read();
  }
}
