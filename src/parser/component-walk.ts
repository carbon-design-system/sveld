/**
 * Parse phase 3: one walk over the instance script and the template.
 * Records props, slots, forwarded events, contexts, bindings, and rest
 * props, and collects the calls that phase 4 ({@link finalizeComponent})
 * turns into dispatched events once the dispatcher's name is known.
 */
import type { CallExpression, Expression, Identifier, Literal, ObjectExpression } from "estree";
import type { AST } from "svelte/compiler";
import { isCallExpressionNamed, isIdentifier, isMemberExpression, unwrapTypeCastExpression } from "../ast-guards";
import type { ComponentElement, ComponentInlineElement, ModernRunesTypeNode, SlotProps, SlotPropValue } from "../model";
import type { TemplateAstNode, TemplateScript } from "../svelte-template-parse";
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
import { addSlot, buildSlotPropsFromObjectExpression, DEFAULT_SLOT_NAME, extractRenderTagInfo } from "./slots";
import { sourceAtPos, sourceRangeFromNode } from "./source-position";
import { collectValueImportBindings } from "./value-imports";
import { walkNodes } from "./walk";

/** Matches `@component` in HTML comments. */
const COMPONENT_COMMENT_REGEX = /^@component/;

const CARRIAGE_RETURN_REGEX = /\r/g;

/**
 * The synthetic root the component walk starts from, so one walk covers
 * both the instance script and the template.
 */
interface ComponentRootNode {
  type: "ComponentRoot";
  instance: TemplateScript | undefined;
  fragment: AST.Fragment | undefined;
}

type ComponentWalkNode = TemplateAstNode | ComponentRootNode;

/**
 * Node types the component walk acts on. Keep in sync with the cases in
 * {@link walkComponent}'s `enter`.
 */
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
export interface NamedCall {
  name: string;
  arguments: Array<Expression | unknown>;
  node: CallExpression;
  /** Detail names a nested scope binds here, read while the scopes are live. */
  nestedBoundDetailNames: Set<string> | undefined;
}

/** What the component walk collects for {@link finalizeComponent}, beyond what it writes to `ctx`. */
export interface ComponentWalkResult {
  /** Local name of the `createEventDispatcher()` result. */
  dispatcherName: string | undefined;
  dispatcherDeclaratorNode: unknown;
  dispatcherTypeArgument: ModernRunesTypeNode | undefined;
  /** Locals bound to `$host()`. */
  hostLocalNames: Set<string>;
  hostDispatchedEventNames: Set<string>;
  hostDispatches: HostDispatch[];
  /**
   * Source ranges are resolved lazily: only calls to the dispatcher need
   * one, and most components' call expressions aren't dispatches.
   */
  callees: NamedCall[];
  /** Every call with arguments, any callee: checked for the dispatcher escaping once its name is known. */
  callsWithArguments: CallExpression[];
  /** Those whose callee a function parameter or nested declaration binds, so it isn't an import. */
  locallyBoundCalls: Set<CallExpression>;
}

/**
 * A call as acorn-typescript parses it: estree's, plus `f<T>()`'s explicit
 * type arguments.
 */
type TsCallExpression = CallExpression & { typeArguments?: { params?: ModernRunesTypeNode[] } };

/** The name `parent` binds a call's result to: `x` in `const x = call()`. */
function parentIdName(parent: ComponentWalkNode | null): string | undefined {
  return parent && "id" in parent && parent.id && "name" in parent.id ? parent.id.name : undefined;
}

function enterCallExpression(
  ctx: ParserContext,
  walk: ComponentWalkResult,
  callExpr: TsCallExpression,
  parent: ComponentWalkNode | null,
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

/** A `<slot>` element: its name, props from its attributes, and fallback content. */
function addSlotElement(ctx: ParserContext, node: AST.SlotElement) {
  type AttributeValueChunk = {
    type?: string;
    expression?: unknown;
    raw?: string;
    start?: number;
    end?: number;
    data?: string;
  };
  // Spreads and directives read as attributes without a value.
  const slotNode = node as {
    attributes?: Array<{
      name?: string;
      value?: true | AttributeValueChunk | AttributeValueChunk[];
    }>;
  };
  const nameAttributeValue = slotNode.attributes?.find((attr) => attr.name === "name")?.value;
  const slot_name = (Array.isArray(nameAttributeValue) ? nameAttributeValue[0] : undefined)?.data;

  const slot_props = (slotNode.attributes || [])
    .filter((attr) => attr.name !== "name")
    .reduce<SlotProps>((slot_props, attr) => {
      const slot_prop_value: SlotPropValue = {
        value: undefined,
        replace: false,
      };

      const value = attr.value;
      if (value === undefined || value === true) return slot_props;

      // Quoted or multi-chunk values are an array. A single expression
      // (`name={expr}` or `{name}`) is unwrapped. Modern AST doesn't
      // distinguish those two.
      const firstValue = Array.isArray(value) ? value[0] : value;

      if (firstValue) {
        const { type, expression, raw, start, end } = firstValue;

        if (type === "Text" && raw !== undefined) {
          slot_prop_value.value = JSON.stringify(raw);
        } else if (
          !Array.isArray(value) &&
          type === "ExpressionTag" &&
          expression &&
          typeof expression === "object" &&
          "type" in expression &&
          expression.type === "Identifier" &&
          "name" in expression &&
          expression.name === attr.name
        ) {
          slot_prop_value.value = (expression as Identifier).name;
          slot_prop_value.replace = true;
        }

        if (expression && typeof expression === "object" && "type" in expression) {
          if (expression.type === "Literal" && "value" in expression) {
            const literalValue = (expression as Literal).value;
            slot_prop_value.value =
              typeof literalValue === "string" ? JSON.stringify(literalValue) : String(literalValue);
          } else if (expression.type === "MemberExpression") {
            slot_prop_value.value = resolveMemberExpressionType(ctx, expression);
          } else if (expression.type !== "Identifier") {
            if (start !== undefined && end !== undefined) {
              if (expression.type === "ObjectExpression" || expression.type === "TemplateLiteral") {
                slot_prop_value.value = sourceAtPos(ctx, start + 1, end - 1);
              }
            }
          }
        }
      }

      if (attr.name) {
        slot_props[attr.name] = slot_prop_value;
      }
      return slot_props;
    }, {});

  const fallback = node.fragment.nodes
    .map(({ start, end }) => sourceAtPos(ctx, start, end) ?? "")
    .join("")
    .trim();

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
  if (!renderInfo) return;

  let slot_props: SlotProps | undefined;
  let slot_props_unresolved_spread = false;
  if (renderInfo.arguments.length === 0) {
    slot_props = {};
  } else if (
    renderInfo.arguments.length === 1 &&
    typeof renderInfo.arguments[0] === "object" &&
    renderInfo.arguments[0] &&
    "type" in renderInfo.arguments[0] &&
    renderInfo.arguments[0].type === "ObjectExpression"
  ) {
    const built = buildSlotPropsFromObjectExpression(ctx, renderInfo.arguments[0] as ObjectExpression);
    slot_props = built.slot_props;
    slot_props_unresolved_spread = built.hasUnresolvedSpread;
  }
  /**
   * Positional arguments (`{@render icon(16)}`, `{@render row(item, index)}`) aren't
   * mapped to slot props: the snippet prop's own type (`Snippet<[...]>`) describes
   * them, and an untyped one is reported as `prop-unknown-type`.
   */

  const slot_name = renderInfo.publicName === "children" ? undefined : renderInfo.publicName;
  const slotKey: string | null = slot_name === undefined ? DEFAULT_SLOT_NAME : slot_name;

  if (slot_props !== undefined) {
    addSlot(ctx, {
      slot_name,
      slot_props,
      slot_props_unresolved_spread: slot_props_unresolved_spread || undefined,
      source: sourceRangeFromNode(ctx, node),
    });
  }

  if (slot_props !== undefined || ctx.slots.has(slotKey)) {
    ctx.snippetPropLocals.add(renderInfo.trackingName);
  }
}

/** A bare `on:event` (no handler) forwards the event; dispatched events win and are reconciled after the walk. */
function addForwardedEvent(ctx: ParserContext, node: AST.OnDirective, parent: ComponentWalkNode | null) {
  const eventName = node.name;
  if (node.expression != null || !eventName) return;
  if (parent == null || !("name" in parent)) return;

  const parentName = typeof parent.name === "string" ? parent.name : undefined;
  const parentType = parent.type;
  if (!parentName || !parentType) return;

  const element: ComponentInlineElement | ComponentElement = isComponentLikeType(parentType)
    ? { type: "InlineComponent", name: parentName }
    : { type: "Element", name: parentName };

  ctx.forwardedEvents.set(eventName, element);

  const existing_event = ctx.events.get(eventName);

  const event_description = ctx.eventDescriptions.get(eventName);
  const event_deprecated = existing_event?.deprecated;
  const event_internal = existing_event?.internal;

  if (!existing_event) {
    ctx.events.set(eventName, {
      type: "forwarded",
      name: eventName,
      element: element,
      description: event_description,
      deprecated: event_deprecated,
      ...(event_internal ? { internal: true as const } : {}),
      source: sourceRangeFromNode(ctx, node),
    });
  } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
    ctx.events.set(eventName, {
      ...existing_event,
      description: event_description,
      deprecated: existing_event.deprecated ?? event_deprecated,
      ...(existing_event.internal || event_internal ? { internal: true as const } : {}),
      source: existing_event.source || sourceRangeFromNode(ctx, node),
    });
  }
}

/** `bind:*` marks props reactive; `bind:this` on elements also narrows the prop type. */
function recordBindDirective(ctx: ParserContext, node: AST.BindDirective, parent: ComponentWalkNode | null) {
  if (!(parent && (isElementLikeType(parent.type) || isComponentLikeType(parent.type)))) {
    return;
  }

  const expressionName = node.expression.type === "Identifier" ? node.expression.name : undefined;
  if (expressionName) {
    const prop_name = resolveIdentifierToReactiveProp(ctx, expressionName);
    if (prop_name) {
      ctx.reactive_vars.add(prop_name);
    }
  }

  if (
    isElementLikeType(parent.type) &&
    node.name === "this" &&
    expressionName &&
    "name" in parent &&
    typeof parent.name === "string"
  ) {
    const prop_name = resolveIdentifierToReactiveProp(ctx, expressionName);
    if (!prop_name) {
      return;
    }
    const element_name = parent.name;

    if (ctx.bindings.has(prop_name)) {
      const existing_bindings = ctx.bindings.get(prop_name);

      if (existing_bindings && !existing_bindings.elements.includes(element_name)) {
        ctx.bindings.set(prop_name, {
          ...existing_bindings,
          elements: [...existing_bindings.elements, element_name],
        });
      }
    } else {
      ctx.bindings.set(prop_name, {
        elements: [element_name],
      });
    }
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

  const componentRoot: ComponentRootNode = {
    type: "ComponentRoot",
    instance: ctx.parsed?.instance,
    fragment: ctx.parsed?.fragment,
  };

  initComponentScope(ctx);
  ctx.activeScopes.push(ctx.componentScope);
  const scopeWalkState = createScopeWalkState(ctx);

  walkNodes<ComponentWalkNode>(
    componentRoot,
    (node, parent) => {
      // Fuse scope declaration into this walk (see enterNestedScopeDeclarationNode).
      // Only scope-owner nodes get a scope, so the returned scope is the
      // same one a `scopeDeclarations.get(node)` lookup would find.
      const nodeScope = enterNestedScopeDeclarationNode(ctx, scopeWalkState, node);
      if (nodeScope) {
        ctx.activeScopes.push(nodeScope);
      }

      // Every case below is keyed on one of these types; most nodes
      // (identifiers, literals, text, elements) match none of them.
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
          // Svelte spread attribute nodes: `{...$$restProps}` and rest-prop locals.
          const name = node.expression.type === "Identifier" ? node.expression.name : undefined;
          if (name === "$$restProps" || ctx.restPropLocals.has(name ?? "")) {
            maybeSetRestProps(ctx, parent);
          }
          break;
        }
        case "FunctionDeclaration":
          if (node.id?.name) {
            ctx.funcDecls.set(node.id.name, node);
          }
          break;
        case "ImportDeclaration":
          collectValueImportBindings(ctx, node);
          break;
        case "VariableDeclaration":
          ctx.vars.add(node);
          if (
            parent?.type === "Program" &&
            node.declarations.some((declarator) =>
              isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props"),
            )
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
          recordBindDirective(ctx, node, parent);
          break;
      }
    },
    (node) => {
      // Scopes exist exactly for scope-owner nodes (see `enter` above), and
      // function-scope owners are a subset, so one type check covers both.
      if (isScopeOwner(node)) {
        ctx.activeScopes.pop();
        leaveNestedScopeDeclarationNode(scopeWalkState, node);
      }
    },
    // Every type this walk acts on is value-level (calls, declarations,
    // assignments, directives, slots), and scopes only come from
    // functions/blocks, so type-level TS subtrees have nothing for it.
    { skipTypeOnlySubtrees: true },
  );

  return walk;
}
