/**
 * Parse phase 3: one walk over the instance script and the template.
 * Records props, slots, forwarded events, contexts, bindings, and rest
 * props, and collects the calls that phase 4 ({@link finalizeComponent})
 * turns into dispatched events once the dispatcher's name is known.
 */
import type {
  AssignmentExpression,
  CallExpression,
  ExportNamedDeclaration,
  Expression,
  FunctionDeclaration,
  Identifier,
  Literal,
  Node,
  ObjectExpression,
  UpdateExpression,
  VariableDeclaration,
} from "estree";
import { isCallExpressionNamed, isIdentifier, isMemberExpression, unwrapTypeCastExpression } from "../ast-guards";
import type { ComponentElement, ComponentInlineElement, ModernRunesTypeNode, SlotProps, SlotPropValue } from "../model";
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
import { collectValueImportBindings, type ImportDeclarationNode } from "./value-imports";
import { type WalkableNode, type WalkEnter, type WalkLeave, walkNodes } from "./walk";

/** Matches `@component` in HTML comments. */
const COMPONENT_COMMENT_REGEX = /^@component/;

const CARRIAGE_RETURN_REGEX = /\r/g;

type TemplateNode = { start?: number; end?: number };

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

function enterCallExpression(ctx: ParserContext, walk: ComponentWalkResult, node: Node, parent: Node | null) {
  const callExpr = node as CallExpression;
  const calleeName =
    callExpr.callee && typeof callExpr.callee === "object" && "name" in callExpr.callee
      ? (callExpr.callee as Identifier).name
      : undefined;

  if (calleeName === "createEventDispatcher") {
    if (
      parent &&
      typeof parent === "object" &&
      "id" in parent &&
      parent.id &&
      typeof parent.id === "object" &&
      "name" in parent.id
    ) {
      walk.dispatcherName = (parent.id as Identifier).name;
      walk.dispatcherDeclaratorNode = parent;
    }
    walk.dispatcherTypeArgument = (
      callExpr as unknown as { typeArguments?: { params?: ModernRunesTypeNode[] } }
    ).typeArguments?.params?.[0];
  }

  if (calleeName === "$host") {
    if (
      parent &&
      typeof parent === "object" &&
      "id" in parent &&
      parent.id &&
      typeof parent.id === "object" &&
      "name" in parent.id
    ) {
      walk.hostLocalNames.add((parent.id as Identifier).name);
    }
  }

  if (calleeName === "setContext") {
    parseSetContextCall(ctx, node, parent ?? undefined);
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
function addSlotElement(ctx: ParserContext, node: Node) {
  type AttributeValueChunk = {
    type?: string;
    expression?: unknown;
    raw?: string;
    start?: number;
    end?: number;
    data?: string;
  };
  const slotNode = node as {
    attributes?: Array<{
      name?: string;
      value?: true | AttributeValueChunk | AttributeValueChunk[];
    }>;
    fragment?: { nodes?: Array<{ start?: number; end?: number }> };
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

  const fallback = (slotNode.fragment?.nodes as TemplateNode[] | undefined)
    ?.map(({ start, end }) => {
      if (start === undefined || end === undefined) return "";
      return sourceAtPos(ctx, start, end) ?? "";
    })
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
function addRenderTagSlot(ctx: ParserContext, node: Node) {
  const renderTag = node as { expression?: unknown };
  const renderInfo = extractRenderTagInfo(ctx, renderTag.expression);
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
function addForwardedEvent(ctx: ParserContext, node: Node, parent: Node | null) {
  const eventHandlerNode = node as { expression?: unknown; name?: string };
  if (eventHandlerNode.expression != null || !eventHandlerNode.name) return;
  if (parent == null || typeof parent !== "object" || !("name" in parent)) return;

  const parentName = typeof parent.name === "string" ? parent.name : undefined;
  const parentType = "type" in parent ? String(parent.type) : undefined;
  if (!parentName || !parentType) return;

  const element: ComponentInlineElement | ComponentElement = isComponentLikeType(parentType)
    ? { type: "InlineComponent", name: parentName }
    : { type: "Element", name: parentName };

  ctx.forwardedEvents.set(eventHandlerNode.name, element);

  const existing_event = ctx.events.get(eventHandlerNode.name);

  const event_description = ctx.eventDescriptions.get(eventHandlerNode.name);
  const event_deprecated = existing_event?.deprecated;
  const event_internal = existing_event?.internal;

  if (!existing_event) {
    ctx.events.set(eventHandlerNode.name, {
      type: "forwarded",
      name: eventHandlerNode.name,
      element: element,
      description: event_description,
      deprecated: event_deprecated,
      ...(event_internal ? { internal: true as const } : {}),
      source: sourceRangeFromNode(ctx, node),
    });
  } else if (existing_event.type === "forwarded" && event_description && !existing_event.description) {
    ctx.events.set(eventHandlerNode.name, {
      ...existing_event,
      description: event_description,
      deprecated: existing_event.deprecated ?? event_deprecated,
      ...(existing_event.internal || event_internal ? { internal: true as const } : {}),
      source: existing_event.source || sourceRangeFromNode(ctx, node),
    });
  }
}

/** `bind:*` marks props reactive; `bind:this` on elements also narrows the prop type. */
function recordBindDirective(ctx: ParserContext, node: Node, parent: Node | null) {
  if (
    !(
      parent &&
      typeof parent === "object" &&
      "type" in parent &&
      (isElementLikeType(String(parent.type)) || isComponentLikeType(String(parent.type)))
    )
  ) {
    return;
  }

  const bindingNode = node as { name?: string; expression?: { name?: string } };
  if (bindingNode.expression?.name) {
    const prop_name = resolveIdentifierToReactiveProp(ctx, bindingNode.expression.name);
    if (prop_name) {
      ctx.reactive_vars.add(prop_name);
    }
  }

  if (
    isElementLikeType(String(parent.type)) &&
    bindingNode.name === "this" &&
    bindingNode.expression?.name &&
    "name" in parent &&
    typeof parent.name === "string"
  ) {
    const prop_name = resolveIdentifierToReactiveProp(ctx, bindingNode.expression.name);
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

  const componentRoot = {
    type: "ComponentRoot",
    instance: ctx.parsed?.instance,
    fragment: ctx.parsed?.fragment,
  };

  initComponentScope(ctx);
  ctx.activeScopes.push(ctx.componentScope);
  const scopeWalkState = createScopeWalkState(ctx);

  walkNodes(
    componentRoot as unknown as WalkableNode,
    ((node: Node, parent: Node | null, _prop: string | null) => {
      // Fuse scope declaration into this walk (see enterNestedScopeDeclarationNode).
      // Only scope-owner nodes get a scope, so the returned scope is the
      // same one a `scopeDeclarations.get(node)` lookup would find.
      const nodeScope = enterNestedScopeDeclarationNode(ctx, scopeWalkState, node);
      if (nodeScope) {
        ctx.activeScopes.push(nodeScope);
      }

      // Svelte template node types aren't in estree's `Node["type"]` union;
      // read the type once as a plain string for the markup checks below.
      const type: string = node.type;

      // Every case below is keyed on one of these types; most nodes
      // (identifiers, literals, text, elements) match none of them.
      if (!MAIN_WALK_NODE_TYPES.has(type)) return;

      switch (type) {
        case "AssignmentExpression":
          markReactivePropsFromMutationTarget(ctx, (node as AssignmentExpression).left);
          break;
        case "UpdateExpression":
          markReactivePropsFromMutationTarget(ctx, (node as UpdateExpression).argument);
          break;
        case "CallExpression":
          enterCallExpression(ctx, walk, node, parent);
          break;
        case "SpreadAttribute": {
          // Svelte spread attribute nodes: `{...$$restProps}` and rest-prop locals.
          const spreadNode = node as { type: string; expression?: { name?: string } };
          if (
            spreadNode.expression?.name === "$$restProps" ||
            ctx.restPropLocals.has(spreadNode.expression?.name ?? "")
          ) {
            maybeSetRestProps(ctx, parent);
          }
          break;
        }
        case "FunctionDeclaration": {
          const funcDecl = node as unknown as FunctionDeclaration;
          if (funcDecl.id?.name) {
            ctx.funcDecls.set(funcDecl.id.name, funcDecl);
          }
          break;
        }
        case "ImportDeclaration":
          collectValueImportBindings(ctx, node as unknown as ImportDeclarationNode);
          break;
        case "VariableDeclaration":
          ctx.vars.add(node as unknown as VariableDeclaration);
          if (
            parent &&
            typeof parent === "object" &&
            "type" in parent &&
            parent.type === "Program" &&
            (node as VariableDeclaration).declarations.some((declarator) =>
              isCallExpressionNamed(unwrapTypeCastExpression(declarator.init), "$props"),
            )
          ) {
            parseRunesPropsDeclaration(ctx, node as VariableDeclaration);
          }
          break;
        case "ExportNamedDeclaration":
          addInstanceExports(ctx, node as ExportNamedDeclaration, parent);
          break;
        case "Comment": {
          const commentNode = node as { data?: string };
          const data: string = commentNode?.data?.trim() ?? "";

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
    }) as unknown as WalkEnter,
    ((node: Node) => {
      // Scopes exist exactly for scope-owner nodes (see `enter` above), and
      // function-scope owners are a subset, so one type check covers both.
      if (isScopeOwner(node)) {
        ctx.activeScopes.pop();
        leaveNestedScopeDeclarationNode(scopeWalkState, node);
      }
    }) as unknown as WalkLeave,
    // Every type this walk acts on is value-level (calls, declarations,
    // assignments, directives, slots), and scopes only come from
    // functions/blocks, so type-level TS subtrees have nothing for it.
    { skipTypeOnlySubtrees: true },
  );

  return walk;
}
