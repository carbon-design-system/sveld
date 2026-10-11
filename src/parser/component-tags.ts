/**
 * Component-level JSDoc tags (`@event`, `@slot`, `@typedef`, `@generics`, ...): anywhere in a
 * component's comments, they describe the component, not the declaration they sit on.
 */
import { closestMatch } from "../levenshtein";
import type { DeprecatedValue, JsDocPassthroughTag, SourceRange } from "../model";
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
import { addSlot, slotKey } from "./slots";
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

type BlockLines = JSDocTag["lines"];

/** Tags that take the description lines directly above them when they have none on their own line. */
const PRECEDING_DESCRIPTION_TAGS = new Set(["restProps", "slot", "snippet", "event", "typedef", "callback"]);

/** Tags that stay inside the preceding `@event`'s scope instead of ending it. */
const EVENT_SCOPE_TAGS = new Set(["property", "type"]);

/** Tags that declare something of their own, closing the preceding `@event`'s scope. */
const EVENT_SCOPE_ENDING_TAGS = new Set(["slot", "snippet", "typedef", "callback"]);

/**
 * Cleaned text on the tag's own line, without the continuation lines `parseComments` folds
 * into `description`. A multi-line `{type}` moves that line down to where the type closes.
 */
function getInlineTagDescription(tagLines: BlockLines): string | undefined {
  if (tagLines.length === 0) return undefined;
  return cleanDescription(tagLines[tagHeadIndex(tagLines)].content);
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
function typedefTakesProperties(typedefType: string): boolean {
  const type = typedefType.trim();
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

/** A `@property` of an `@event` detail or an object `@typedef`. */
interface TagProperty {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  default?: string;
}

/** An `@event`, `@typedef`, or `@callback` still collecting the tags below it. */
interface OpenDeclaration {
  name: string;
  description: string | undefined;
  source: SourceRange | undefined;
  tags: JsDocPassthroughTag[];
  internal: boolean;
}

interface OpenEvent extends OpenDeclaration {
  type: string;
  deprecated: DeprecatedValue | undefined;
  tagLine: number | undefined;
  ignores: string[];
  properties: TagProperty[];
}

interface OpenTypedef extends OpenDeclaration {
  type: string;
  properties: TagProperty[];
}

interface OpenCallback extends OpenDeclaration {
  params: Array<{ name: string; type: string; optional?: boolean }>;
  returnType: string | undefined;
}

/** `@typedef` and `@callback` share `ctx.typedefs`, so either one can overwrite the other. */
function addTypedef(
  ctx: ParserContext,
  { name, description, tags, internal, source }: OpenDeclaration,
  type: string,
  ts: string,
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

  private event: OpenEvent | undefined;
  private typedef: OpenTypedef | undefined;
  private callback: OpenCallback | undefined;

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
    const inline = getInlineTagDescription(tagSource);
    const nextTagTakesTextAbove =
      nextTag !== undefined && PRECEDING_DESCRIPTION_TAGS.has(nextTag.tag) && !getInlineTagDescription(nextTag.lines);
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
    const { event } = this;
    if (event === undefined || event.description) return;
    // Indented lines under the `@event` are its description; they're merged in later.
    if (event.tagLine !== undefined && this.indentedContinuationLines.has(event.tagLine + 1)) return;
    if (previousTag?.tag !== "event" && !EVENT_SCOPE_TAGS.has(previousTag?.tag ?? "")) return;
    if (getInlineTagDescription(tagSource)) return;
    const label = name ? `@${tag} "${name}"` : `@${tag}`;
    recordDiagnostic(
      this.ctx,
      "event-description-ambiguous",
      event.name,
      `Text after @event "${event.name}" was used as the description of ${label}. Move it above the tag it describes, indent it as a continuation line, or give each event its own comment block.`,
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
    const { ctx, event } = this;
    if (event === undefined) return;
    this.event = undefined;
    // Prefer explicit `@type` over `@property`-built objects; `{object}` falls through.
    const explicitType = event.type && event.type !== "object" && event.type !== "Object" ? event.type : undefined;
    const detailType =
      explicitType ??
      (event.properties.length > 0 ? buildEventDetailFromProperties(event.properties, true) : event.type || "");

    const { tagLine } = event;
    if (tagLine !== undefined) {
      const scopeBoundaryLine = this.tags.find((t) => {
        const line = t.lines[0]?.number;
        return line !== undefined && line > tagLine && !EVENT_SCOPE_TAGS.has(t.tag);
      })?.lines[0].number;
      const trailing = Array.from(this.lineDescriptions.keys())
        .sort((a, b) => a - b)
        .filter(
          (lineNum) =>
            lineNum > tagLine &&
            (scopeBoundaryLine === undefined || lineNum < scopeBoundaryLine) &&
            !this.consumedDescriptionLines.has(lineNum) &&
            this.lineDescriptions.get(lineNum)?.trim(),
        );
      for (const lineNum of trailing) this.consumedDescriptionLines.add(lineNum);
      if (trailing.length > 0) {
        event.description = this.joinBlockLines(
          trailing,
          event.description ? { text: event.description, line: tagLine } : undefined,
        );
      }
    }

    const { name, description, source } = event;
    // With no `{type}` or `@property`, the `null` detail is only a fallback that a dispatch
    // replaces (see `addDispatchedEvent`), unless an earlier `@event` typed this one.
    const fallbackDetail = detailType === "" && (!ctx.events.has(name) || ctx.untypedJsDocEventNames.has(name));
    addDispatchedEvent(ctx, {
      name,
      detail: detailType,
      has_argument: false,
      description,
      deprecated: event.deprecated,
      tags: event.tags.length > 0 ? event.tags : undefined,
      internal: event.internal || undefined,
      source,
    });
    if (fallbackDetail) ctx.untypedJsDocEventNames.add(name);
    ctx.eventDescriptions.set(name, description);
    ctx.jsDocEventNames.add(name);
    ctx.jsDocEventSources.set(name, source);
    recordSveldIgnore(ctx, "event-no-source", name, event.ignores);
  }

  private finalizeTypedef() {
    const { ctx, typedef } = this;
    if (typedef === undefined) return;
    this.typedef = undefined;
    const { properties } = typedef;
    const hasProperties = properties.length > 0;
    const typedefType = hasProperties ? buildEventDetailFromProperties(properties, true) : typedef.type || "{}";
    const ts =
      !hasProperties && typedef.type && isSingleObjectLiteral(typedefType)
        ? `interface ${typedef.name} ${typedefType}`
        : `type ${typedef.name} = ${typedefType};`;

    const members = hasProperties
      ? properties
          .filter(({ name }) => !name.includes(".") && !name.startsWith("["))
          .map(({ name, type, optional, description }) => ({
            name,
            type,
            optional: optional === true,
            ...(description ? { description } : {}),
          }))
      : parseObjectTypeLiteralMembers(typedefType, { skipIndexSignatures: true });
    if (members) ctx.typedefMembersByName.set(typedef.name, members);

    addTypedef(ctx, typedef, typedefType, ts);
  }

  private finalizeCallback() {
    const { callback } = this;
    if (callback === undefined) return;
    this.callback = undefined;
    const type = `(${formatParamList(callback.params)}) => ${callback.returnType || "void"}`;
    addTypedef(this.ctx, callback, type, `type ${callback.name} = ${type};`);
  }

  /**
   * Opens a `@typedef`/`@callback`: its name (with any `@template`s above it), description,
   * and the tags queued for it. Tags after it attach to it.
   */
  private openTypeDeclaration(tagIndex: number): OpenDeclaration {
    const { name, lines: tagSource } = this.tags[tagIndex];
    const declaration: OpenDeclaration = {
      name: this.typeDeclarationName(name),
      source: sourceRangeFromCommentTag(this.ctx, tagSource),
      description: this.orCommentDescription(
        this.getTagDescription(tagSource, this.tags[tagIndex + 1]) || this.takePrecedingDescription(tagIndex),
      ),
      tags: this.pendingTags.splice(0),
      internal: this.pendingInternal,
    };
    const { tags } = declaration;
    this.pendingInternal = false;
    this.attachTrailingTag = (trailingTag) => tags.push(trailingTag);
    this.isFirstTag = false;
    return declaration;
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
    // `@slot {Type} - description` describes the default slot, as does `@snippet {Type} children`.
    const name = rawName === "-" || (tag === "snippet" && rawName === "children") ? undefined : rawName;
    let slotDesc = this.orCommentDescription(this.getTagDescription(tagSource, this.tags[tagIndex + 1]));
    if (!slotDesc && this.pendingTags.length === 0) {
      slotDesc = this.takePrecedingDescription(tagIndex);
    }
    this.isFirstTag = false;
    const slotType = type || "Record<string, never>";
    const source = sourceRangeFromCommentTag(this.ctx, tagSource);
    if (!type) {
      recordDiagnostic(
        this.ctx,
        "slot-missing-type",
        name || "default",
        `@${tag}${name ? ` "${name}"` : ""} is missing a required {Type} annotation; falling back to "${slotType}".`,
        source,
      );
    }
    const slotTags = this.pendingTags.splice(0);
    const key = slotKey(name);
    this.ctx.jsDocSlots.set(key, { tag, source });
    addSlot(this.ctx, {
      slot_name: name,
      slot_props: slotType,
      slot_description: slotDesc || undefined,
      slot_deprecated: this.pendingDeprecated,
      slot_tags: slotTags.length > 0 ? slotTags : undefined,
      slot_internal: this.pendingInternal || undefined,
      source,
    });
    this.pendingDeprecated = undefined;
    this.pendingInternal = false;
    this.attachTrailingTag = (trailingTag) => {
      const slot = this.ctx.slots.get(key);
      if (slot) slot.tags = [...(slot.tags ?? []), trailingTag];
    };
  }

  private readEvent(tagIndex: number, type: string) {
    const { name, lines: tagSource } = this.tags[tagIndex];
    // Claim the text above before the previous event takes it as its trailing description.
    const description = getInlineTagDescription(tagSource) || this.takePrecedingDescription(tagIndex);
    this.finalizeEvent();

    const tags = this.pendingTags.splice(0);
    this.event = {
      name,
      type,
      tagLine: tagSource.length > 0 ? tagSource[0].number : undefined,
      description: this.orCommentDescription(description),
      source: sourceRangeFromCommentTag(this.ctx, tagSource),
      tags,
      internal: false,
      deprecated: undefined,
      ignores: [],
      properties: [],
    };
    this.attachTrailingTag = (trailingTag) => tags.push(trailingTag);
    this.isFirstTag = false;
  }

  private readProperty(tagIndex: number, type: string) {
    const { name, optional, default: defaultValue, lines: tagSource } = this.tags[tagIndex];
    const description = this.getTagDescription(tagSource, this.tags[tagIndex + 1], this.event !== undefined);
    const owner = this.event ?? (this.typedef && typedefTakesProperties(this.typedef.type) ? this.typedef : undefined);
    if (owner === undefined) return;
    pushOrReplaceProperty(
      this.ctx,
      owner.properties,
      { name, type, description, optional: optional || false, default: defaultValue },
      owner.name,
      sourceRangeFromCommentTag(this.ctx, tagSource),
    );
  }

  private readTypedef(tagIndex: number, type: string) {
    this.finalizeTypedef();
    this.typedef = { ...this.openTypeDeclaration(tagIndex), type, properties: [] };
  }

  private readCallback(tagIndex: number) {
    this.finalizeCallback();
    this.callback = { ...this.openTypeDeclaration(tagIndex), params: [], returnType: undefined };
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
    const { event } = this;
    // The first `@deprecated` wins.
    if ((event ? event.deprecated : this.pendingDeprecated) !== undefined) return;
    const setDeprecated = (value: DeprecatedValue) => {
      if (event) event.deprecated = value;
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
          if (this.event) this.event.type = type;
          break;
        case "param":
          this.callback?.params.push({ name, type, optional: optional || false });
          break;
        case "returns":
        case "return":
          if (this.callback) this.callback.returnType = type;
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
          if (this.event) this.event.internal = true;
          else this.pendingInternal = true;
          break;
        case "sveld-ignore":
          this.event?.ignores.push(name);
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
