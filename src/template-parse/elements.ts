import type { Expression } from "estree";
import type { AST } from "svelte/compiler";
import { closingTagOmitted } from "./autoclosing";
import { readExpression } from "./expression";
import { decodeCharacterReferences } from "./html-entities";
import { TemplateParseNotImplementedError } from "./not-implemented";
import { isWhitespace, TemplateSyntaxError } from "./reader";
import { readScript } from "./script";
import type { StackNode, TemplateParserState } from "./state";
import { readStyle } from "./style";
import { isValidTagName, isVoidElement } from "./void-elements";

const REGEX_ATTRIBUTE_VALUE = /(?:"([^"]*)"|'([^'])*'|([^>\s]+))/y;
const REGEX_STARTS_WITH_QUOTE = /["']/y;
const REGEX_INVALID_UNQUOTED_ATTRIBUTE_VALUE = /(\/>|[\s"'=<>`])/y;
const REGEX_CLOSING_TEXTAREA_TAG = /<\/textarea(\s[^>]*)?>/iy;
const REGEX_DOCTYPE_NAME = /^![a-zA-Z]+$/;
const REGEX_NAMESPACED_NAME = /^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$/;

// Identifier continuation chars incl. ZWJ/ZWNJ. Byte-identical to svelte's
// `regex_valid_component_name` source.
// biome-ignore format: kept on one line so the lint suppression below stays adjacent to it
// biome-ignore lint/suspicious/noMisleadingCharacterClass: see comment above
const REGEX_VALID_COMPONENT_NAME = /^(?:\p{Lu}[$\u200c\u200d\p{ID_Continue}.]*|\p{ID_Start}[$\u200c\u200d\p{ID_Continue}]*(?:\.[$\u200c\u200d\p{ID_Continue}]+)+)$/u;

const ROOT_ONLY_META_TAGS: Record<string, AST.ElementLike["type"]> = {
  "svelte:head": "SvelteHead",
  "svelte:options": "SvelteOptions" as AST.ElementLike["type"],
  "svelte:window": "SvelteWindow",
  "svelte:document": "SvelteDocument",
  "svelte:body": "SvelteBody",
};

const META_TAGS: Record<string, AST.ElementLike["type"]> = {
  ...ROOT_ONLY_META_TAGS,
  "svelte:element": "SvelteElement",
  "svelte:component": "SvelteComponent",
  "svelte:self": "SvelteSelf",
  "svelte:fragment": "SvelteFragment",
  "svelte:boundary": "SvelteBoundary",
};

/** True for names like `div` or `h1`. No regex. */
function isPlainLowercaseTagName(name: string): boolean {
  const first = name.charCodeAt(0);
  if (first < 97 || first > 122) return false;
  for (let i = 1; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if ((code < 97 || code > 122) && (code < 48 || code > 57)) return false;
  }
  return true;
}

function isValidElementName(name: string): boolean {
  if (isPlainLowercaseTagName(name)) return true;
  if (REGEX_DOCTYPE_NAME.test(name)) return true;
  if (REGEX_NAMESPACED_NAME.test(name)) return true;
  return isValidTagName(name);
}

/**
 * `REGEX_VALID_COMPONENT_NAME` always needs an uppercase first letter or a
 * `.` somewhere. A lowercase ASCII name with no dots (every standard HTML
 * tag) can skip the Unicode regex.
 */
function maybeComponentName(name: string): boolean {
  const first = name.charCodeAt(0);
  if (first >= 97 && first <= 122 && !name.includes(".")) return false;
  return true;
}

/**
 * svelte grows meta tags over time (`<svelte:boundary>` arrived in 5.3).
 * An unknown `<svelte:x>` parses like any element and gets the type name
 * svelte's convention would give it (`svelte:portal` -> "SveltePortal"),
 * so one new tag degrades to a generic node instead of failing the whole
 * component. The user's own svelte compile still validates for real.
 */
function unknownMetaTagType(name: string): AST.ElementLike["type"] {
  const derived = name
    .slice("svelte:".length)
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
  return `Svelte${derived}` as AST.ElementLike["type"];
}

function parentIsHead(stack: StackNode[]): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    const type = stack[i].type;
    if (type === "SvelteHead") return true;
    if (type === "RegularElement" || type === "Component") return false;
  }
  return false;
}

function parentIsShadowRootTemplate(stack: StackNode[]): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    const node = stack[i];
    if (
      node.type === "RegularElement" &&
      (node.attributes as Array<{ type: string; name?: string }>)?.some(
        (attribute) => attribute.type === "Attribute" && attribute.name === "shadowrootmode",
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Tag name. Stops at whitespace, `/`, or `>`. charCode loop, not regex `exec`. */
function readTagName(state: TemplateParserState) {
  const source = state.source;
  const start = state.index;
  if (start >= source.length) throw new TemplateSyntaxError("Unexpected end of input", source.length);
  let end = start;
  while (end < source.length) {
    const code = source.charCodeAt(end);
    if (code === 47 /* / */ || code === 62 /* > */ || isWhitespace(code)) break;
    end++;
  }
  state.index = end;
  return { name: source.slice(start, end), start, end };
}

/** Attribute name. Stops at whitespace, `=`, `/`, `>`, `"`, or `'`. */
function readAttributeToken(state: TemplateParserState) {
  const source = state.source;
  const start = state.index;
  if (start >= source.length) throw new TemplateSyntaxError("Unexpected end of input", source.length);
  let end = start;
  while (end < source.length) {
    const code = source.charCodeAt(end);
    if (
      code === 61 /* = */ ||
      code === 47 /* / */ ||
      code === 62 /* > */ ||
      code === 34 /* " */ ||
      code === 39 /* ' */ ||
      isWhitespace(code)
    ) {
      break;
    }
    end++;
  }
  state.index = end;
  return { name: source.slice(start, end), start, end };
}

function readComment(state: TemplateParserState): void {
  const start = state.index;

  if (state.eat("//")) {
    const value = state.readUntilString("\n");
    const end = state.index;
    state.root.comments.push({ type: "Line", value, start, end });
    return;
  }

  if (state.eat("/*")) {
    const value = state.readUntilString("*/");
    state.eat("*/");
    const end = state.index;
    state.root.comments.push({ type: "Block", value, start, end });
  }
}

function getDirectiveType(name: string): AST.Directive["type"] | false {
  if (name === "use") return "UseDirective";
  if (name === "animate") return "AnimateDirective";
  if (name === "bind") return "BindDirective";
  if (name === "class") return "ClassDirective";
  if (name === "style") return "StyleDirective";
  if (name === "on") return "OnDirective";
  if (name === "let") return "LetDirective";
  if (name === "in" || name === "out" || name === "transition") return "TransitionDirective";
  return false;
}

/** Text/ExpressionTag chunks until `done()`. From svelte's `read_sequence` in `state/element.js`. */
function readSequence(state: TemplateParserState, done: () => boolean): Array<AST.Text | AST.ExpressionTag> {
  let currentChunk: AST.Text = { start: state.index, end: -1, type: "Text", raw: "", data: "" };
  const chunks: Array<AST.Text | AST.ExpressionTag> = [];

  const flush = (end: number) => {
    if (end > currentChunk.start) {
      currentChunk.raw = state.source.slice(currentChunk.start, end);
      currentChunk.data = decodeCharacterReferences(currentChunk.raw, true);
      currentChunk.end = end;
      chunks.push(currentChunk);
    }
  };

  while (state.index < state.source.length) {
    if (done()) {
      flush(state.index);
      return chunks;
    }

    if (state.eat("{")) {
      if (state.match("#") || state.match("@")) {
        throw new TemplateParseNotImplementedError("blocks/tags inside attribute value sequences");
      }

      // Captured before `allowWhitespace` so `{ expr }` starts at the `{`,
      // matching svelte's `read_sequence`.
      const expressionStart = state.index - 1;
      flush(expressionStart);
      state.allowWhitespace();
      const expression = readExpression(state);
      state.allowWhitespace();
      state.eat("}", true);

      chunks.push({ type: "ExpressionTag", start: expressionStart, end: state.index, expression });
      currentChunk = { start: state.index, end: -1, type: "Text", raw: "", data: "" };
    } else {
      state.index++;
    }
  }

  throw new TemplateParseNotImplementedError("unterminated attribute value / sequence (loose mode)");
}

function readAttributeValue(
  state: TemplateParserState,
): true | AST.ExpressionTag | Array<AST.Text | AST.ExpressionTag> {
  const quoteMark = state.eat("'") ? "'" : state.eat('"') ? '"' : null;
  if (quoteMark && state.eat(quoteMark)) {
    return [{ start: state.index - 1, end: state.index - 1, type: "Text", raw: "", data: "" }];
  }

  const value = readSequence(state, () => {
    if (quoteMark) return state.match(quoteMark);
    return !!state.matchRegex(REGEX_INVALID_UNQUOTED_ATTRIBUTE_VALUE);
  });

  if (value.length === 0 && !quoteMark) {
    throw new Error("sveld: expected attribute value");
  }

  if (quoteMark) state.index += 1;

  if (quoteMark || value.length > 1 || value[0].type === "Text") {
    return value;
  }
  return value[0];
}

// `name_loc` is omitted. sveld never reads it, so this isn't a real
// `AST.Attribute` (which requires it).
function createAttribute(name: string, start: number, end: number, value: AST.Attribute["value"]): AST.Attribute {
  return { type: "Attribute", start, end, name, value } as unknown as AST.Attribute;
}

/** For top-level `<script>`/`<style>` tags, which don't support directives. From svelte's `read_static_attribute`. */
function readStaticAttribute(state: TemplateParserState): AST.Attribute | null {
  const start = state.index;
  const tag = readAttributeToken(state);
  if (!tag.name) return null;

  let value: true | Array<AST.Text | AST.ExpressionTag> = true;

  if (state.eat("=")) {
    state.allowWhitespace();
    let raw = state.matchRegex(REGEX_ATTRIBUTE_VALUE);
    if (!raw) throw new Error("sveld: expected attribute value");
    state.index += raw.length;

    const quoted = raw[0] === '"' || raw[0] === "'";
    if (quoted) raw = raw.slice(1, -1);

    value = [
      {
        start: state.index - raw.length - (quoted ? 1 : 0),
        end: quoted ? state.index - 1 : state.index,
        type: "Text",
        raw,
        data: decodeCharacterReferences(raw, true),
      },
    ];
  }

  if (state.matchRegex(REGEX_STARTS_WITH_QUOTE)) {
    throw new Error("sveld: expected '='");
  }

  return createAttribute(tag.name, start, state.index, value);
}

type AttributeLike = AST.Attribute | AST.SpreadAttribute | AST.Directive | AST.AttachTag;

/** From svelte's `read_attribute` (`state/element.js`). */
function readAttribute(state: TemplateParserState): AttributeLike | null {
  while (true) {
    const before = state.index;
    readComment(state);
    if (state.index === before) break;
    state.allowWhitespace();
  }

  const start = state.index;

  if (state.eat("{")) {
    state.allowWhitespace();

    if (state.eat("@attach")) {
      state.requireWhitespace();
      const expression = readExpression(state);
      state.allowWhitespace();
      state.eat("}", true);
      const attachment: AST.AttachTag = { type: "AttachTag", start, end: state.index, expression };
      return attachment;
    }

    if (state.eat("...")) {
      const expression = readExpression(state);
      state.allowWhitespace();
      state.eat("}", true);
      const spread: AST.SpreadAttribute = { type: "SpreadAttribute", start, end: state.index, expression };
      return spread;
    }

    const id = state.readIdentifierName();
    if (id.name === "") {
      throw new Error("sveld: empty attribute shorthand");
    }

    state.allowWhitespace();
    state.eat("}", true);

    const expression: AST.ExpressionTag = {
      type: "ExpressionTag",
      start: id.start,
      end: id.end,
      // Reuse `id` as the expression, matching svelte.
      expression: id as never,
    };

    return createAttribute(id.name, start, state.index, expression);
  }

  const tag = readAttributeToken(state);
  if (!tag.name) return null;

  let end = state.index;
  state.allowWhitespace();

  const colonIndex = tag.name.indexOf(":");
  const directiveType = colonIndex !== -1 && getDirectiveType(tag.name.slice(0, colonIndex));

  let value: true | AST.ExpressionTag | Array<AST.Text | AST.ExpressionTag> = true;
  if (state.eat("=")) {
    state.allowWhitespace();

    if (state.source[state.index] === "/" && state.source[state.index + 1] === ">") {
      const charStart = state.index;
      state.index++;
      value = [{ start: charStart, end: charStart + 1, type: "Text", raw: "/", data: "/" }];
      end = state.index;
    } else {
      value = readAttributeValue(state);
      end = state.index;
    }
  } else if (state.matchRegex(REGEX_STARTS_WITH_QUOTE)) {
    throw new Error("sveld: expected '='");
  }

  if (directiveType) {
    // Only the name before the first `|` matters. Modifiers, `intro`/`outro`,
    // and `name_loc` are never read.
    const directiveName = tag.name.slice(colonIndex + 1).split("|", 1)[0];
    if (directiveName === "") throw new Error("sveld: directive missing a name");

    if (directiveType === "StyleDirective") {
      return {
        start,
        end,
        type: directiveType,
        name: directiveName,
        value,
      } as unknown as AST.StyleDirective;
    }

    const firstValue = value === true ? undefined : Array.isArray(value) ? value[0] : value;
    let expression: Expression | null = null;

    if (firstValue) {
      const containsText = (Array.isArray(value) ? value.length > 1 : false) || firstValue.type === "Text";
      if (containsText) throw new Error("sveld: directive value must be a single expression");
      expression = (firstValue as AST.ExpressionTag).expression as never;
    }

    const directive = {
      start,
      end,
      type: directiveType,
      name: directiveName,
      expression,
    } as unknown as AST.Directive;

    if ((directive.type === "BindDirective" || directive.type === "ClassDirective") && !directive.expression) {
      (directive as AST.BindDirective).expression = {
        start: start + colonIndex + 1,
        end,
        type: "Identifier",
        name: directive.name,
      } as never;
    }

    return directive;
  }

  return createAttribute(tag.name, start, end, value);
}

/**
 * From svelte's `element()` in `state/element.js`. `<svelte:options>` is
 * parsed here as a root-only meta element, then lifted into `Root.options`
 * by `index.ts`.
 */
export function readElement(state: TemplateParserState): void {
  const start = state.index++;
  let parent = state.current();

  if (state.eat("!--")) {
    const data = state.readUntilString("-->");
    state.eat("-->", true);
    state.append({ type: "Comment", start, end: state.index, data } as AST.Comment);
    return;
  }

  if (state.eat("/")) {
    const { name } = readTagName(state);
    state.allowWhitespace();
    state.eat(">", true);

    if (isVoidElement(name)) throw new Error(`sveld: <${name}> is a void element and cannot have a closing tag`);

    while ((parent as { name?: string }).name !== name) {
      if (parent.type === "RegularElement") {
        // svelte would warn here. Tree shape doesn't change.
      } else {
        throw new Error(`sveld: invalid closing tag </${name}>`);
      }

      parent.end = start;
      state.pop();
      parent = state.current();
    }

    parent.end = state.index;
    state.pop();

    if (state.lastAutoClosedTag && state.stack.length < state.lastAutoClosedTag.depth) {
      state.lastAutoClosedTag = undefined;
    }

    return;
  }

  const tag = readTagName(state);

  const isComponentName = maybeComponentName(tag.name) && REGEX_VALID_COMPONENT_NAME.test(tag.name);
  if (!isValidElementName(tag.name) && !isComponentName) {
    throw new Error(`sveld: "${tag.name}" is not a valid element or component name`);
  }

  if (tag.name in ROOT_ONLY_META_TAGS && parent.type !== "Root") {
    throw new Error(`sveld: <${tag.name}> must be a top-level element`);
  }

  let type: AST.ElementLike["type"];
  if (tag.name in META_TAGS) {
    type = META_TAGS[tag.name];
  } else if (tag.name.startsWith("svelte:")) {
    type = unknownMetaTagType(tag.name);
  } else if (isComponentName) {
    type = "Component";
  } else if (tag.name === "title" && parentIsHead(state.stack)) {
    type = "TitleElement";
  } else if (tag.name === "slot" && !parentIsShadowRootTemplate(state.stack)) {
    type = "SlotElement";
  } else {
    type = "RegularElement";
  }

  const element: AST.ElementLike = {
    type,
    start,
    end: -1,
    name: tag.name,
    attributes: [],
    fragment: { type: "Fragment", nodes: [] },
  } as unknown as AST.ElementLike;

  state.allowWhitespace();

  if (parent.type === "RegularElement" && closingTagOmitted(parent.name as string, tag.name)) {
    parent.end = start;
    state.pop();
    state.lastAutoClosedTag = { tag: parent.name as string, reason: tag.name, depth: state.stack.length };
    parent = state.current();
  }

  const current = state.current();
  const isTopLevelScriptOrStyle = (tag.name === "script" || tag.name === "style") && current.type === "Root";
  const read = isTopLevelScriptOrStyle ? readStaticAttribute : readAttribute;

  let attribute: AttributeLike | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: mirrors svelte's own `while ((attribute = read(parser)))` loop
  while ((attribute = read(state))) {
    (element.attributes as AttributeLike[]).push(attribute);
    state.allowWhitespace();
  }

  if (element.type === "SvelteComponent") {
    (element as AST.SvelteComponent).expression = attributeExpression(takeThisAttribute(element));
  }

  if (element.type === "SvelteElement") {
    const definition = takeThisAttribute(element);
    if (definition.value === true) throw new Error("sveld: <svelte:element> `this` attribute needs a value");

    if (isExpressionAttribute(definition)) {
      (element as AST.SvelteElement).tag = attributeExpression(definition);
    } else {
      // `this="div"` is a plain string, not `this={expr}`. Treat it as `this={'div'}`.
      const chunk = (definition.value as Array<AST.Text | AST.ExpressionTag>)[0];
      (element as AST.SvelteElement).tag =
        chunk.type === "Text"
          ? ({ type: "Literal", value: chunk.data, raw: `'${chunk.raw}'`, start: chunk.start, end: chunk.end } as never)
          : chunk.expression;
    }
  }

  if (isTopLevelScriptOrStyle) {
    state.eat(">", true);

    if (tag.name === "script") {
      const content = readScript(state, start, element.attributes as AST.Attribute[]);
      if (content.context === "module") {
        if (state.root.module) throw new Error("sveld: duplicate <script module>");
        state.root.module = content;
      } else {
        if (state.root.instance) throw new Error("sveld: duplicate <script>");
        state.root.instance = content;
      }
    } else {
      if (state.root.css) throw new Error("sveld: duplicate <style>");
      state.root.css = readStyle(state, start, element.attributes as AST.Attribute[]);
    }
    return;
  }

  state.append(element as unknown as AST.Fragment["nodes"][number]);

  const selfClosing = state.eat("/") || isVoidElement(tag.name);
  state.eat(">", true);

  if (selfClosing) {
    element.end = state.index;
  } else if (tag.name === "textarea") {
    element.fragment.nodes = readSequence(state, () => {
      REGEX_CLOSING_TEXTAREA_TAG.lastIndex = state.index;
      return REGEX_CLOSING_TEXTAREA_TAG.test(state.source);
    });
    state.read(REGEX_CLOSING_TEXTAREA_TAG);
    element.end = state.index;
  } else {
    state.push(element as unknown as StackNode, element.fragment);
  }
}

function takeThisAttribute(element: AST.ElementLike): AST.Attribute {
  const attributes = element.attributes as AST.Attribute[];
  const index = attributes.findIndex((a) => a.type === "Attribute" && a.name === "this");
  if (index === -1) throw new Error(`sveld: <${element.name}> requires a \`this\` attribute`);
  return attributes.splice(index, 1)[0];
}

function attributeExpression(attribute: AST.Attribute) {
  return Array.isArray(attribute.value)
    ? (attribute.value[0] as AST.ExpressionTag).expression
    : (attribute.value as AST.ExpressionTag).expression;
}

/** True for `this={expr}` or `{this}`. False for `this="literal text"`. */
function isExpressionAttribute(attribute: AST.Attribute): boolean {
  return (
    (attribute.value !== true && !Array.isArray(attribute.value)) ||
    (Array.isArray(attribute.value) && attribute.value.length === 1 && attribute.value[0].type === "ExpressionTag")
  );
}
