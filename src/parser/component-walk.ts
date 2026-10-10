/**
 * Parse phase 3: one walk over the instance script and the template.
 * Records props, slots, forwarded events, contexts, bindings, and rest
 * props, and collects the calls that phase 4 ({@link finalizeComponent})
 * turns into dispatched events once the dispatcher's name is known.
 */
import type { AST, CallExpression, Expression, SimpleCallExpression, TSNode } from "sveast";
import { SKIP, type Visitor, walk as walkTree } from "sveast/walk";
import { isCallExpressionNamed, isIdentifier, isMemberExpression } from "../ast-guards";
import type { ElementNamespace } from "../element-tag-map";
import type { ComponentElement, ComponentInlineElement, SlotProps, SlotPropValue } from "../model";
import { resolveMemberExpressionType } from "./bindings";
import type { ParserContext } from "./context";
import { parseSetContextCall } from "./contexts";
import { isComponentLikeType, isElementLikeType } from "./element-kind";
import { detailNamesBoundInNestedScope, type HostDispatch, parseHostDispatchEventCall } from "./events";
import { addInstanceExports } from "./exports";
import { maybeSetRestProps } from "./rest-props";
import { parseRunesPropsDeclaration } from "./runes-props";
import {
  createScopeWalkState,
  enterNestedScopeDeclarationNode,
  initComponentScope,
  isCalleeBoundInNestedScope,
  isScopeOwner,
  leaveNestedScopeDeclarationNode,
  markReactivePropsFromMutationTarget,
  resolveIdentifierToReactiveProp,
} from "./scopes";
import {
  addSlot,
  buildSlotPropsFromObjectExpression,
  DEFAULT_SLOT_NAME,
  extractRenderTagInfo,
  renderTagCall,
  slotKey,
} from "./slots";
import { sourceAtPos, sourceRangeFromNode } from "./source-position";
import { collectValueImportBindings } from "./value-imports";
import { isTypeOnlySubtree } from "./walk";

const COMPONENT_COMMENT_REGEX = /^@component/;

const CARRIAGE_RETURN_REGEX = /\r/g;

/** Keep in sync with the cases in {@link walkComponent}'s `enter`. */
const MAIN_WALK_NODE_TYPES = new Set([
  "AssignmentExpression",
  "UpdateExpression",
  "CallExpression",
  "SpreadAttribute",
  "FunctionDeclaration",
  "ImportDeclaration",
  "VariableDeclaration",
  "ExportNamedDeclaration",
  "Comment",
  "SlotElement",
  "RenderTag",
  "OnDirective",
  "BindDirective",
]);

/** A call to a named function: a dispatch once the dispatcher's name is known. */
interface NamedCall {
  name: string;
  arguments: Array<Expression | unknown>;
  node: CallExpression;
  /** Detail names a nested scope binds here, read while the scopes are live. */
  nestedBoundDetailNames: Set<string> | undefined;
}

/** What the component walk collects for {@link finalizeComponent}, beyond what it writes to `ctx`. */
export interface ComponentWalkResult {
  dispatcherName: string | undefined;
  dispatcherDeclaratorNode: unknown;
  dispatcherTypeArgument: TSNode | undefined;
  /** Locals bound to `$host()`. */
  hostLocalNames: Set<string>;
  hostDispatchedEventNames: Set<string>;
  hostDispatches: HostDispatch[];
  /** Source ranges resolve lazily: most calls aren't dispatches. */
  callees: NamedCall[];
  /** Every call with arguments, any callee: checked for the dispatcher escaping once its name is known. */
  callsWithArguments: CallExpression[];
  /** Those whose callee a function parameter or nested declaration binds, so it isn't an import. */
  locallyBoundCalls: Set<CallExpression>;
}

/** The name `parent` binds a call's result to: `x` in `const x = call()`. */
function parentIdName(parent: AST.SvelteNode | null): string | undefined {
  return parent && "id" in parent && parent.id && "name" in parent.id ? parent.id.name : undefined;
}

function enterCallExpression(
  ctx: ParserContext,
  walk: ComponentWalkResult,
  callExpr: SimpleCallExpression,
  parent: AST.SvelteNode | null,
) {
  const calleeName = callExpr.callee.type === "Identifier" ? callExpr.callee.name : undefined;

  if (calleeName === "createEventDispatcher") {
    const name = parentIdName(parent);
    if (name !== undefined) {
      walk.dispatcherName = name;
      walk.dispatcherDeclaratorNode = parent;
    }
    walk.dispatcherTypeArgument = callExpr.typeArguments?.params?.[0];
  }

  if (calleeName === "$host") {
    const name = parentIdName(parent);
    if (name !== undefined) walk.hostLocalNames.add(name);
  }

  if (calleeName === "setContext") {
    parseSetContextCall(ctx, callExpr);
  }

  if (callExpr.arguments.length > 0) {
    walk.callsWithArguments.push(callExpr);
    if (isCalleeBoundInNestedScope(ctx, callExpr.callee)) walk.locallyBoundCalls.add(callExpr);
  }

  if (calleeName) {
    walk.callees.push({
      name: calleeName,
      arguments: callExpr.arguments,
      node: callExpr,
      nestedBoundDetailNames: detailNamesBoundInNestedScope(ctx, callExpr.arguments[1]),
    });
  }

  if (
    isMemberExpression(callExpr.callee) &&
    isIdentifier(callExpr.callee.property) &&
    callExpr.callee.property.name === "dispatchEvent" &&
    (isCallExpressionNamed(callExpr.callee.object, "$host") ||
      (isIdentifier(callExpr.callee.object) && walk.hostLocalNames.has(callExpr.callee.object.name)))
  ) {
    const hostDispatch = parseHostDispatchEventCall(ctx, callExpr);
    if (hostDispatch) {
      walk.hostDispatchedEventNames.add(hostDispatch.name);
      walk.hostDispatches.push(hostDispatch);
    }
  }
}

/** The `value` of a `<slot>` attribute as a slot prop. */
function slotPropValueFromAttribute(
  ctx: ParserContext,
  name: string,
  value: Exclude<AST.Attribute["value"], true>,
): SlotPropValue {
  const slot_prop_value: SlotPropValue = { value: undefined, replace: false };
  // Quoted or multi-chunk values are an array; `name={expr}` and `{name}` are a bare tag.
  const first = Array.isArray(value) ? value[0] : value;

  if (first?.type === "Text") {
    slot_prop_value.value = JSON.stringify(first.raw);
  } else if (first?.type === "ExpressionTag") {
    const { expression } = first;
    if (expression.type === "Identifier") {
      if (!Array.isArray(value) && expression.name === name) {
        slot_prop_value.value = expression.name;
        slot_prop_value.replace = true;
      }
    } else if (expression.type === "Literal") {
      slot_prop_value.value =
        typeof expression.value === "string" ? JSON.stringify(expression.value) : String(expression.value);
    } else if (expression.type === "MemberExpression") {
      slot_prop_value.value = resolveMemberExpressionType(ctx, expression);
    } else if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
      // The tag's range includes its braces.
      slot_prop_value.value = sourceAtPos(ctx, first.start + 1, first.end - 1);
    }
  }
  return slot_prop_value;
}

function addSlotElement(ctx: ParserContext, node: AST.SlotElement) {
  const nameAttribute = node.attributes.find((attr) => "name" in attr && attr.name === "name");
  const nameValue = nameAttribute && "value" in nameAttribute ? nameAttribute.value : undefined;
  const firstNameChunk = Array.isArray(nameValue) ? nameValue[0] : undefined;
  const slot_name = firstNameChunk?.type === "Text" ? firstNameChunk.data : undefined;

  const slot_props: SlotProps = {};
  for (const attr of node.attributes) {
    // Only attributes and `style:` directives have a `value`.
    if (!("value" in attr) || attr.name === "name" || attr.value === true) continue;
    slot_props[attr.name] = slotPropValueFromAttribute(ctx, attr.name, attr.value);
  }

  const fallback = node.fragment.nodes
    .map(({ start, end }) => sourceAtPos(ctx, start, end) ?? "")
    .join("")
    .trim();

  ctx.renderedSlots.add(slotKey(slot_name));
  addSlot(ctx, {
    slot_name,
    slot_props,
    slot_fallback: fallback,
    source: sourceRangeFromNode(ctx, node),
  });
}

/** `{@render name(...)}`: the snippet prop `name` becomes a slot, typed from an object argument. */
function addRenderTagSlot(ctx: ParserContext, node: AST.RenderTag) {
  const renderInfo = extractRenderTagInfo(ctx, node.expression);
  if (!renderInfo) {
    // `{@render props[name]()}` may render any snippet prop.
    const { callee } = renderTagCall(node.expression);
    if (isMemberExpression(callee) && isIdentifier(callee.object) && ctx.wholePropsLocals.has(callee.object.name)) {
      ctx.slotsUntracked = true;
    }
    return;
  }

  // Positional arguments (`{@render row(item, index)}`) aren't slot props: the
  // snippet prop's own `Snippet<[...]>` type describes them.
  const [first, ...rest] = renderInfo.arguments;
  let slot_props: SlotProps | undefined;
  let slot_props_unresolved_spread = false;
  if (first === undefined) {
    slot_props = {};
  } else if (rest.length === 0 && first.type === "ObjectExpression") {
    const built = buildSlotPropsFromObjectExpression(ctx, first);
    slot_props = built.slot_props;
    slot_props_unresolved_spread = built.hasUnresolvedSpread;
  }

  const slot_name = renderInfo.publicName === "children" ? undefined : renderInfo.publicName;
  ctx.renderedSlots.add(slotKey(slot_name));

  if (slot_props !== undefined) {
    addSlot(ctx, {
      slot_name,
      slot_props,
      slot_props_unresolved_spread: slot_props_unresolved_spread || undefined,
      source: sourceRangeFromNode(ctx, node),
    });
  }

  if (slot_props !== undefined || ctx.slots.has(slot_name ?? DEFAULT_SLOT_NAME)) {
    ctx.snippetPropLocals.add(renderInfo.trackingName);
  }
}

/** A bare `on:event` (no handler) forwards the event; dispatched events win and are reconciled after the walk. */
function addForwardedEvent(ctx: ParserContext, node: AST.OnDirective, parent: AST.SvelteNode | null) {
  const eventName = node.name;
  if (node.expression != null || !eventName) return;
  if (parent == null || !("name" in parent) || typeof parent.name !== "string" || !parent.name) return;

  const element: ComponentInlineElement | ComponentElement = isComponentLikeType(parent.type)
    ? { type: "InlineComponent", name: parent.name }
    : { type: "Element", name: parent.name };

  ctx.forwardedEvents.set(eventName, element);

  const existing = ctx.events.get(eventName);
  const description = ctx.eventDescriptions.get(eventName);

  if (!existing) {
    ctx.events.set(eventName, {
      type: "forwarded",
      name: eventName,
      element,
      description,
      deprecated: undefined,
      source: sourceRangeFromNode(ctx, node),
    });
  } else if (existing.type === "forwarded" && description && !existing.description) {
    ctx.events.set(eventName, {
      ...existing,
      description,
      deprecated: existing.deprecated,
      source: existing.source || sourceRangeFromNode(ctx, node),
    });
  }
}

/** `bind:*` marks props reactive; `bind:this` on elements also narrows the prop type. */
function recordBindDirective(
  ctx: ParserContext,
  node: AST.BindDirective,
  parent: AST.SvelteNode | null,
  namespace: ElementNamespace,
) {
  if (!parent || !(isElementLikeType(parent.type) || isComponentLikeType(parent.type))) return;
  if (node.expression.type !== "Identifier") return;

  const prop_name = resolveIdentifierToReactiveProp(ctx, node.expression.name);
  if (!prop_name) return;
  ctx.reactive_vars.add(prop_name);

  if (node.name !== "this" || !isElementLikeType(parent.type) || !("name" in parent)) return;
  if (typeof parent.name !== "string") return;

  const element = { tag: parent.name, namespace };
  const existing = ctx.bindings.get(prop_name);
  if (!existing) {
    ctx.bindings.set(prop_name, { elements: [element] });
  } else if (!existing.elements.some((other) => other.tag === element.tag && other.namespace === namespace)) {
    ctx.bindings.set(prop_name, { ...existing, elements: [...existing.elements, element] });
  }
}

/** Walks the instance script and the template in one pass, with the component's scopes live. */
export function walkComponent(ctx: ParserContext): ComponentWalkResult {
  const walk: ComponentWalkResult = {
    dispatcherName: undefined,
    dispatcherDeclaratorNode: undefined,
    dispatcherTypeArgument: undefined,
    hostLocalNames: new Set(),
    hostDispatchedEventNames: new Set(),
    hostDispatches: [],
    callees: [],
    callsWithArguments: [],
    locallyBoundCalls: new Set(),
  };

  initComponentScope(ctx);
  ctx.activeScopes.push(ctx.componentScope);
  const scopeWalkState = createScopeWalkState(ctx);

  // An element's namespace, and the namespace its children are created in:
  // `<svg>` switches to SVG and `<foreignObject>` back to HTML for its children.
  const elementNamespaces = new WeakMap<AST.SvelteNode, ElementNamespace>();
  const childNamespaces: ElementNamespace[] = [ctx.parsed?.options?.namespace === "svg" ? "svg" : "html"];

  const visitor: Visitor = {
    enter(node, parent) {
      // Everything this walk acts on is value-level, and type-level TS
      // subtrees own no scopes.
      if (isTypeOnlySubtree(node.type)) return SKIP;

      // Scope declaration is fused into this walk.
      const nodeScope = enterNestedScopeDeclarationNode(ctx, scopeWalkState, node);
      if (nodeScope) ctx.activeScopes.push(nodeScope);

      if (isElementLikeType(node.type)) {
        const name = "name" in node ? node.name : undefined;
        const namespace = name === "svg" ? "svg" : childNamespaces[childNamespaces.length - 1];
        elementNamespaces.set(node, namespace);
        childNamespaces.push(name === "foreignObject" ? "html" : namespace);
      }

      if (!MAIN_WALK_NODE_TYPES.has(node.type)) return;

      switch (node.type) {
        case "AssignmentExpression":
          markReactivePropsFromMutationTarget(ctx, node.left);
          break;
        case "UpdateExpression":
          markReactivePropsFromMutationTarget(ctx, node.argument);
          break;
        case "CallExpression":
          enterCallExpression(ctx, walk, node, parent);
          break;
        case "SpreadAttribute": {
          const name = node.expression.type === "Identifier" ? node.expression.name : undefined;
          const isRestLocal = ctx.restPropLocals.has(name ?? "");
          if (name === "$$restProps" || isRestLocal) {
            maybeSetRestProps(ctx, parent);
          }
          // `$$props` carries legacy slots, and a runes rest object carries snippet props.
          if ((name === "$$props" || isRestLocal) && parent && isComponentLikeType(parent.type)) {
            ctx.slotsUntracked = true;
          }
          break;
        }
        case "FunctionDeclaration":
          if (node.id?.name) ctx.funcDecls.set(node.id.name, node);
          break;
        case "ImportDeclaration":
          collectValueImportBindings(ctx, node);
          break;
        case "VariableDeclaration":
          ctx.vars.add(node);
          if (
            parent?.type === "Program" &&
            node.declarations.some((declarator) => isCallExpressionNamed(declarator.init, "$props"))
          ) {
            parseRunesPropsDeclaration(ctx, node);
          }
          break;
        case "ExportNamedDeclaration":
          addInstanceExports(ctx, node, parent?.type === "Program" ? parent : null);
          break;
        case "Comment": {
          const data = node.data.trim();
          if (COMPONENT_COMMENT_REGEX.test(data)) {
            ctx.componentComment = data.replace(COMPONENT_COMMENT_REGEX, "").replace(CARRIAGE_RETURN_REGEX, "");
            ctx.componentCommentSource = sourceRangeFromNode(ctx, node);
          }
          break;
        }
        case "SlotElement":
          addSlotElement(ctx, node);
          break;
        case "RenderTag":
          addRenderTagSlot(ctx, node);
          break;
        case "OnDirective":
          addForwardedEvent(ctx, node, parent);
          break;
        case "BindDirective":
          recordBindDirective(ctx, node, parent, (parent && elementNamespaces.get(parent)) ?? "html");
          break;
      }
    },
    leave(node) {
      if (isElementLikeType(node.type)) childNamespaces.pop();
      // `enter` pushes a scope for exactly the scope-owner nodes.
      if (isScopeOwner(node)) {
        ctx.activeScopes.pop();
        leaveNestedScopeDeclarationNode(scopeWalkState, node);
      }
    },
  };
  // One pass: the script's scopes stay live while the template is walked.
  if (ctx.parsed?.instance) walkTree(ctx.parsed.instance, visitor);
  if (ctx.parsed?.fragment) walkTree(ctx.parsed.fragment, visitor);

  return walk;
}
