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

const WHITESPACE_CHAR_REGEX = /\s/;

// A non-JSDoc comment (a `// biome-ignore` or
// `/* istanbul ignore next */` line) doesn't detach a JSDoc block from
// its declaration.
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

// Lines inside a ``` fence keep their indentation relative to the
// fence's opening line, blank lines included; prose lines don't.
export function joinDescriptionLines(lines: readonly string[]): string {
  const out: string[] = [];
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
  return description?.replace(DESCRIPTION_DASH_PREFIX_REGEX, "").trim();
}

// Tag parsing reads the first word as a name
// (`@type {T} Opens the modal`), so it's joined back on.
export function typeTagDescription(tag: JSDocTag): string | undefined {
  const text = tag.name ? `${tag.name} ${tag.description}` : tag.description;
  return cleanDescription(joinDescriptionLines(text.split("\n")));
}

export function tagHeadIndex(tagLines: ReadonlyArray<{ continuesType?: true }>): number {
  let headIndex = 0;
  while (tagLines[headIndex + 1]?.continuesType) headIndex++;
  return headIndex;
}

// These are exposed as `tags` instead of joining prose descriptions.
export const IDE_PASSTHROUGH_TAGS = new Set(["since", "example", "see"]);

// Known, so never flagged, but outside `parseCustomTypes`'s switch:
// `@bindable` is read in `getCommentTags`, and `@default`/`@required`
// are conventional but unused.
export const OTHER_KNOWN_JSDOC_TAGS = new Set(["bindable", "default", "required"]);

function toPassthroughTags(tags: JSDocTag[]): JsDocPassthroughTag[] | undefined {
  return tags.length > 0 ? tags.map((tag) => ({ name: tag.tag, body: tag.text })) : undefined;
}

export function deprecatedValueFromBody(body: string): DeprecatedValue {
  const message = body.trim();
  return message === "" ? true : message;
}

// `parseComments` needs the `/** ... */` delimiters back.
function formatComment(comment: string) {
  const opened = comment.startsWith("/*") ? comment : `/*${comment}`;
  return opened.endsWith("*/") ? opened : `${opened}*/`;
}

export function aliasType(type: string): string {
  return type === "*" ? "any" : type.trim();
}

// Needs no parser context, so modules outside a component can use the
// `extractJsDoc*` helpers.
function commentTagsOf(commentValue: string) {
  return getCommentTags(parseComments(formatComment(commentValue)));
}

export function extractJsDocReturnType(commentValue: string): string | undefined {
  const { returns } = commentTagsOf(commentValue);
  return returns ? aliasType(returns.type) : undefined;
}

export function extractJsDocType(commentValue: string): string | undefined {
  const { type } = commentTagsOf(commentValue);
  return type ? aliasType(type.type) : undefined;
}

export function extractJsDocDeprecatedAndTags(commentValue: string): {
  deprecated?: DeprecatedValue;
  tags?: JsDocPassthroughTag[];
  internal: boolean;
} {
  const { deprecated, passthrough, internal } = commentTagsOf(commentValue);
  return { deprecated, tags: toPassthroughTags(passthrough), internal };
}

// Handled structurally or elsewhere, so these never land in `additional`.
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

// Memoized, since the leading-comment pass and the variable JSDoc table
// parse the same blocks; callers must never mutate the results.
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

  let typeTag: JSDocTag | undefined;
  const paramTags: JSDocTag[] = [];
  let returnsTag: JSDocTag | undefined;
  let binding: ComponentPropBinding | undefined;
  let deprecated: DeprecatedValue | undefined;
  let internal = false;
  const additionalTags: JSDocTag[] = [];
  const passthroughTags: JSDocTag[] = [];
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
      if (tag.type) continue;
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

interface LeadingJSDocComment {
  value: string;
  start: number;
  end: number;
}

// Reuses the block `parseCustomTypes` parsed at this offset only when
// it spans the same text: that scan opens a block only where `/**`
// leads its line and closes on a line ending in `*/`, so equal `start`
// and `end` tokenize as `formatComment(value)` would. Anything else
// (`/** doc */ code` on one line, `/***`) is parsed from `value`.
function parsedSourceBlock(ctx: ParserContext, comment: LeadingJSDocComment): JSDocComment[] | undefined {
  const block = ctx.jsDocBlocksByStart.get(comment.start);
  return block?.end === comment.end ? [block] : undefined;
}

function findAdjacentJSDocComment(
  ctx: ParserContext,
  leadingComments: unknown[] | undefined,
  nodeStart: number | undefined,
): LeadingJSDocComment | undefined {
  if (!leadingComments || leadingComments.length === 0 || nodeStart === undefined || !ctx.source) return undefined;

  for (let index = leadingComments.length - 1; index >= 0; index--) {
    const comment = leadingComments[index];
    if (!comment || typeof comment !== "object" || !("value" in comment) || !("end" in comment)) continue;
    if (typeof comment.end !== "number" || !("start" in comment) || typeof comment.start !== "number") continue;
    // A `//` line or plain `/* *\/` block (e.g. a lint suppression) isn't the
    // doc comment.
    if (("type" in comment && comment.type === "Line") || !String(comment.value).startsWith("*")) continue;

    if (isJsDocGap(ctx.source, comment.end, nodeStart)) return comment as LeadingJSDocComment;
  }

  return undefined;
}

const FUNCTION_EXPRESSION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

// A `@template` in these types the function's own generic parameter,
// not the component's, unless it's on an instance-script `export let`:
// that's a prop, so its `@template` still declares a component generic.
export function functionDocCommentStarts(ctx: ParserContext): Set<number> {
  const starts = new Set<number>();
  const addDocumented = (node: unknown) => {
    const { leadingComments, start } = node as { leadingComments?: unknown[]; start?: number };
    const comment = findAdjacentJSDocComment(ctx, leadingComments, start);
    if (comment) starts.add(comment.start);
  };
  for (const funcDecl of ctx.funcDecls.values()) addDocumented(funcDecl);

  // Read from the `export` statement too, since an exported declaration's
  // doc comment sits there, not on the declaration.
  const scripts = [
    { root: ctx.parsed?.module, isModule: true },
    { root: ctx.parsed?.instance, isModule: false },
  ];
  for (const { root, isModule } of scripts) {
    for (const statement of root?.content.body ?? []) {
      const isExported = statement.type === "ExportNamedDeclaration";
      const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
      if (declaration?.type === "FunctionDeclaration") {
        if (isExported) addDocumented(statement);
      } else if (declaration?.type === "ClassDeclaration" && isModule) {
        // A module-script class's `@template`s are its own, as are its methods'.
        addDocumented(isExported ? statement : declaration);
        for (const member of declaration.body.body) {
          if (member.type === "MethodDefinition") addDocumented(member);
        }
      } else if (
        declaration?.type === "VariableDeclaration" &&
        (isModule || !isExported || declaration.kind === "const") &&
        declaration.declarations.length === 1 &&
        FUNCTION_EXPRESSION_TYPES.has(declaration.declarations[0].init?.type ?? "")
      ) {
        addDocumented(statement);
      }
    }
  }
  return starts;
}

// These declare part of the component's API instead of documenting the
// declaration below.
const COMPONENT_LEVEL_TAGS = new Set([
  "slot",
  "snippet",
  "event",
  "typedef",
  "callback",
  "restProps",
  "extends",
  "extendProps",
  "csspart",
  "cssprop",
  "cssproperty",
]);

export function processNodeJSDoc(
  ctx: ParserContext,
  node: { leadingComments?: unknown[]; start?: number } | null | undefined,
) {
  const comment = findAdjacentJSDocComment(ctx, node?.leadingComments, node?.start);
  return comment && processJSDocComment(ctx, comment);
}

function templateTagConstraint(name: string, type: string, defaultValue: string | undefined): string {
  let constraint = name;
  if (type) constraint = `${name} extends ${type}`;
  if (defaultValue) constraint += ` = ${defaultValue}`;
  return constraint;
}

const TEMPLATE_FIRST_NAME_REGEX = /^[^\s,]+/;
const TEMPLATE_NEXT_NAME_REGEX = /^\s*,\s*([^\s,]+)/;

// As in TypeScript, a `{constraint}` or `[T=default]` applies only to
// the first name in `@template T, U`.
export function templateTagParameters(tag: JSDocTag, type: string): Array<{ name: string; constraint: string }> {
  const firstName = tag.optional ? tag.name : TEMPLATE_FIRST_NAME_REGEX.exec(tag.name)?.[0];
  if (!firstName) return [];
  const parameters = [{ name: firstName, constraint: templateTagConstraint(firstName, type, tag.default) }];
  // Past the first name, only the rest of an unspaced `T,U` name token comes
  // before the description.
  let rest = `${tag.optional ? "" : tag.name.slice(firstName.length)} ${tag.description}`;
  for (let match = TEMPLATE_NEXT_NAME_REGEX.exec(rest); match; match = TEMPLATE_NEXT_NAME_REGEX.exec(rest)) {
    parameters.push({ name: match[1], constraint: match[1] });
    rest = rest.slice(match[0].length);
  }
  return parameters;
}

const OBJECT_PLACEHOLDER_TYPES = new Set(["", "any", "object", "Object"]);
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

// As TypeScript reads them, `@param options.label` tags become members
// of `options`' type only when it's declared just `{object}`.
function paramsWithNestedMembers(paramTags: JSDocTag[]): ComponentPropParam[] {
  const membersByParam = new Map<string, string[]>();
  for (const { name, type, optional } of paramTags) {
    const [param, member, ...deeper] = name.split(".");
    if (!member || deeper.length > 0) continue;
    const members = membersByParam.get(param) ?? [];
    // Quoted as a key unless it's an identifier, since `options.aria-label` is
    // a member all the same.
    const key = IDENTIFIER_REGEX.test(member) ? member : JSON.stringify(member);
    members.push(`${key}${optional ? "?" : ""}: ${aliasType(type) || "any"}`);
    membersByParam.set(param, members);
  }
  return paramTags
    .filter((tag) => !tag.name.includes("."))
    .map((tag) => {
      const members = membersByParam.get(tag.name);
      const type = aliasType(tag.type);
      const description = cleanDescription(joinDescriptionLines(tag.description.split("\n")));
      return {
        name: tag.name,
        type: members && OBJECT_PLACEHOLDER_TYPES.has(type) ? `{ ${members.join("; ")} }` : type,
        ...(description ? { description } : {}),
        optional: tag.optional,
      };
    });
}

function processJSDocComment(ctx: ParserContext, jsdocComment: LeadingJSDocComment): NodeJsDoc | undefined {
  const comment = parsedSourceBlock(ctx, jsdocComment) ?? parseCommentText(ctx, formatComment(jsdocComment.value));
  // A block declaring component-level items (`@slot`, `@event`, `@typedef`,
  // ...) documents the component, not the declaration below it.
  if (comment[0]?.tags.some(({ tag }) => COMPONENT_LEVEL_TAGS.has(tag))) return undefined;
  const tags = getCommentTags(comment);

  const params = tags.param.length > 0 ? paramsWithNestedMembers(tags.param) : undefined;

  // A function's own `@template`s become its type parameters; anywhere else
  // they (and `@generics`) declare component generics. Neither is
  // description text.
  let typeParameters: string | undefined;
  if (ctx.functionDocCommentStarts.has(jsdocComment.start)) {
    const templateTags = tags.additional.filter((tag) => tag.tag === "template" && tag.name);
    if (templateTags.length > 0) {
      typeParameters = templateTags
        .flatMap((tag) => templateTagParameters(tag, aliasType(tag.type)))
        .map(({ constraint }) => constraint)
        .join(", ");
    }
  }
  const descriptionTags = tags.additional.filter((tag) => tag.tag !== "template" && tag.tag !== "generics");

  const formattedDescription = tags.description?.trim();
  const describe = (described: JSDocTag[]) => {
    const parts = [
      ...(formattedDescription ? [formattedDescription] : []),
      // Rebuilt from the text as written, so a `{...}` in it
      // (`@default { a: 1 }`) survives.
      ...described.map((tag) => `@${tag.tag}${tag.text ? ` ${tag.text}` : ""}`),
    ];
    return parts.length > 0 ? parts.join("\n") : undefined;
  };
  const defaultTag = descriptionTags.find((tag) => tag.tag === "default" && tag.text.trim());

  return {
    type: tags.type ? aliasType(tags.type.type) : undefined,
    params,
    returnType: tags.returns ? aliasType(tags.returns.type) : undefined,
    description: describe(descriptionTags),
    binding: tags.binding,
    deprecated: tags.deprecated,
    tags: toPassthroughTags(tags.passthrough),
    sveldIgnore: tags.ignore.length > 0 ? tags.ignore : undefined,
    internal: tags.internal,
    typeParameters,
    ...(defaultTag
      ? {
          explicitDefault: defaultTag.text.trim(),
          descriptionWithoutDefault: describe(descriptionTags.filter((tag) => tag !== defaultTag)),
        }
      : {}),
  };
}
