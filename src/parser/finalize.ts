/**
 * Parse phase 4: settle what the walks left open (dispatched vs forwarded
 * events, slot prop types, generics), record the diagnostics that need
 * the whole component, and build the {@link ParsedComponent}.
 */
import { type CallExpression, isValidType as isOneType, type Literal } from "sveast";
import { getElementByTag } from "../element-tag-map";
import type {
  ComponentContext,
  ComponentParseResult,
  ComponentProp,
  ComponentSlot,
  ForwardedEvent,
  ParsedComponent,
  SerializedComponentEvent,
  SourceRange,
  TypeDef,
} from "../model";
import { PARSED_COMPONENT_TYPE_SCRIPT_METADATA } from "../parsed-component-metadata";
import { isValidTypeText } from "../type-text-validity";
import type { ComponentWalkResult } from "./component-walk";
import { getPropTypeByLocalOrPublic, type ParserContext, resolvePublicPropName } from "./context";
import { buildDiagnostic, isSveldIgnored, recordDiagnostic, recordSveldIgnore } from "./diagnostics";
import { compareSerializedEvents } from "./event-order";
import {
  addDispatchedEvent,
  addHostDispatchedEvent,
  componentDetailTypeSource,
  deriveDetailType,
  findDispatcherArgument,
  literalDetailToTypeText,
} from "./events";
import { accumulateGeneric, parseGenericsAttribute } from "./generics";
import { normalizeRunesCallbackProps, registerTypedDispatcherEvents } from "./runes-props";
import { DEFAULT_SLOT_NAME } from "./slots";
import { sourceForExpression, sourceRangeFromNode, sourceRangeFromOffsets } from "./source-position";
import { buildPendingCrossFileCandidates, buildTypeScriptMetadata } from "./type-resolution";
import { importedCalleeBinding } from "./value-imports";
import { resolveLocalVarJSDoc } from "./variable-jsdoc";

/** A JSDoc `@slot`/`@snippet` type of `{}`. */
const EMPTY_OBJECT_TYPE_REGEX = /^\{\s*\}$/;

function mapToArray<T>(map: Map<string, T> | Map<string | null, T>) {
  return Array.from(map.values());
}

function literalValue(node: unknown): Literal["value"] | undefined {
  return node && typeof node === "object" && "value" in node ? (node as Literal).value : undefined;
}

/**
 * Adds the events the dispatcher and `$host().dispatchEvent()` dispatch, and
 * turns a JSDoc `@event` that's only forwarded with `on:` into a forwarded
 * event. Returns the names actually dispatched.
 */
function resolveDispatchedEvents(ctx: ParserContext, walk: ComponentWalkResult): Set<string> {
  const { dispatcherName, callees } = walk;
  const actuallyDispatchedEvents = new Set<string>(walk.hostDispatchedEventNames);

  for (const hostDispatch of walk.hostDispatches) addHostDispatchedEvent(ctx, hostDispatch);

  if (dispatcherName !== undefined) {
    registerTypedDispatcherEvents(
      ctx,
      walk.dispatcherTypeArgument,
      dispatcherName,
      sourceRangeFromNode(ctx, walk.dispatcherDeclaratorNode),
    );

    for (const callee of callees) {
      if (callee.name !== dispatcherName) continue;
      const event_name = literalValue(callee.arguments[0]);
      const event_argument = callee.arguments[1];
      const structuralDetail = deriveDetailType(
        componentDetailTypeSource(ctx, callee.nestedBoundDetailNames),
        event_argument,
      );
      if (event_name == null) continue;
      const event_detail = structuralDetail === undefined ? literalValue(event_argument) : undefined;
      // A `null` value is also how a regex/bigint literal the runtime can't build looks, so check `raw`.
      const isNullLiteral = event_detail === null && (event_argument as Literal).raw === "null";

      addDispatchedEvent(ctx, {
        name: String(event_name),
        detail:
          structuralDetail ??
          (isNullLiteral ? "null" : event_detail == null ? "" : literalDetailToTypeText(event_detail)),
        has_argument: Boolean(event_argument),
        source: sourceRangeFromNode(ctx, callee.node),
      });
      actuallyDispatchedEvents.add(String(event_name));
    }
  }

  // An `@event` that's only forwarded with `on:` becomes a forwarded event.
  ctx.forwardedEvents.forEach((element, eventName) => {
    const event = ctx.events.get(eventName);
    if (event && event.type === "dispatched" && !actuallyDispatchedEvents.has(eventName)) {
      const event_description = ctx.eventDescriptions.get(eventName);
      const forwardedEvent: ForwardedEvent = {
        type: "forwarded",
        name: eventName,
        element,
        description: event_description,
        deprecated: event.deprecated,
        tags: event.tags,
        source: event.source,
      };
      if (event.internal) forwardedEvent.internal = true;
      // Keep explicit `@event` detail types, including `null`.
      if (event.detail !== undefined && event.detail !== "undefined") forwardedEvent.detail = event.detail;
      ctx.events.set(eventName, forwardedEvent);
    }
  });

  return actuallyDispatchedEvents;
}

/** Props in output form: `bind:this` element types applied, and snippet props left to their slots. */
function buildProps(ctx: ParserContext): ComponentProp[] {
  const snippetPropNames =
    ctx.syntaxMode === "runes"
      ? new Set(Array.from(ctx.snippetPropLocals, (localName) => resolvePublicPropName(ctx, localName)))
      : new Set<string>();

  // A snippet prop is emitted from its slot, unless its render call took
  // positional arguments and left no slot to stand in for it.
  return mapToArray(ctx.props)
    .filter(
      (prop) =>
        !(snippetPropNames.has(prop.name) && ctx.slots.has(prop.name === "children" ? DEFAULT_SLOT_NAME : prop.name)),
    )
    .map((prop) => {
      const reactive = prop.reactive || ctx.reactive_vars.has(prop.name);
      const binding = ctx.bindings.get(prop.name);
      if (!binding) return { ...prop, reactive };

      const elementTypes = binding.elements
        .sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
        .map(({ tag, namespace }) => getElementByTag(tag, namespace))
        .join(" | ");
      return { ...prop, type: `null | ${elementTypes}`, typeSource: "inferred" as const, reactive };
    });
}

/** Slots in output form, sorted by name, with template-built slot props formatted as type text. */
function buildSlots(ctx: ParserContext): ComponentSlot[] {
  return mapToArray(ctx.slots)
    .map((slot) => {
      const { slot_props_unresolved_spread, ...publicSlot } = slot;

      // JSDoc `@slot`/`@snippet` tags are already TS type text; template parsing yields a SlotProps map.
      if (!slot.slot_props) {
        return publicSlot as ComponentSlot;
      }
      if (typeof slot.slot_props === "string") {
        return EMPTY_OBJECT_TYPE_REGEX.test(slot.slot_props)
          ? { ...publicSlot, slot_props: "Record<string, never>" }
          : (publicSlot as ComponentSlot);
      }

      const new_props: string[] = [];
      for (const [key, slotProp] of Object.entries(slot.slot_props)) {
        if (slotProp.replace && slotProp.value !== undefined) {
          slotProp.value = getPropTypeByLocalOrPublic(ctx, slotProp.value);
        }
        slotProp.value ??= "any";
        new_props.push(`${key}: ${slotProp.value}`);
      }

      const widenSuffix = slot_props_unresolved_spread ? " & Record<string, any>" : "";

      // Force multiline when count > 1 (matches interface body formatting).
      const formatted_slot_props =
        new_props.length === 0
          ? slot_props_unresolved_spread
            ? "Record<string, any>"
            : "Record<string, never>"
          : new_props.length === 1
            ? `{ ${new_props[0]} }${widenSuffix}`
            : `{\n  ${new_props.join(";\n  ")};\n}${widenSuffix}`;

      return { ...publicSlot, slot_props: formatted_slot_props };
    })
    .sort((a, b) => {
      const aName = a.name ?? "";
      const bName = b.name ?? "";
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });
}

/**
 * Adds the `@template`s of `@slot`/`@snippet` blocks that the output types
 * use to the component's generics, then lets the `generics` script
 * attribute, if any, replace them all.
 */
function resolveGenerics(ctx: ParserContext, props: ComponentProp[], slots: ComponentSlot[]) {
  if (ctx.deferredSlotBlockGenerics.length > 0) {
    const referencedTypeText = [
      ...props.map((prop) => prop.type ?? ""),
      ...slots.map((slot) => slot.slot_props ?? ""),
    ].join("\n");
    for (const { name, constraint } of ctx.deferredSlotBlockGenerics) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\b${escapedName}\\b`).test(referencedTypeText)) continue;
      accumulateGeneric(ctx, name, constraint);
    }
  }

  // The compiler-checked `generics` attribute wins over `@generics`/`@template` tags.
  if (ctx.scriptGenericsAttribute) {
    if (ctx.generics) {
      recordDiagnostic(
        ctx,
        "syntax-skipped",
        "generics",
        `Both the "generics" script attribute and @generics/@template JSDoc tags declare component generics; the script attribute takes precedence and the JSDoc declaration was ignored.`,
        ctx.scriptGenericsAttribute.source,
      );
    }
    ctx.generics = parseGenericsAttribute(ctx.scriptGenericsAttribute.value);
  }
}

/** Events in output form, sorted: forwarded events name their element as a string. */
function serializeEvents(ctx: ParserContext): SerializedComponentEvent[] {
  return mapToArray(ctx.events)
    .map((event): SerializedComponentEvent => {
      switch (event.type) {
        case "forwarded":
          return { ...event, element: event.element.name };
        case "dispatched":
          return event;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    })
    .sort(compareSerializedEvents);
}

/** Types an untyped call default `any` and reports every prop whose type is still unknown. */
function recordUnknownPropTypes(ctx: ParserContext, props: ComponentProp[], moduleExports: ComponentProp[]) {
  const pendingCallDefaultsByLocation = {
    props: new Map(ctx.pendingCallDefaultCandidates.filter((c) => c.location === "props").map((c) => [c.propName, c])),
    moduleExports: new Map(
      ctx.pendingCallDefaultCandidates.filter((c) => c.location === "moduleExports").map((c) => [c.propName, c]),
    ),
  };

  for (const prop of props) {
    if (prop.typeSource === "unknown") {
      const callDefault = pendingCallDefaultsByLocation.props.get(prop.name);
      // Never leave type unset: the writer would emit `id?: undefined;`.
      if (callDefault) prop.type = "any";

      const message = callDefault
        ? callDefault.importSource
          ? `Prop "${prop.name}" default calls "${callDefault.calleeName}()" imported from "${callDefault.importSource}"; falling back to "any" pending cross-file resolution.`
          : `Prop "${prop.name}" default calls "${callDefault.calleeName}()", but its return type could not be inferred; falling back to "any".`
        : `Prop "${prop.name}" type could not be inferred; falling back to "${prop.type ?? "any"}".`;

      recordDiagnostic(ctx, "prop-unknown-type", prop.name, message, prop.source);
    }
  }

  for (const moduleExport of moduleExports) {
    if (moduleExport.typeSource === "unknown" && pendingCallDefaultsByLocation.moduleExports.has(moduleExport.name)) {
      moduleExport.type = "any";
    }
  }
}

/** Whether `type` parses as TypeScript; records a `type-syntax-error` when it doesn't. */
function isValidType(ctx: ParserContext, type: string | undefined, name: string, source?: SourceRange): boolean {
  if (type === undefined || isValidTypeText(type)) return true;
  // Valid when not inline, so what failed is the check for a `//` comment.
  const problem = isOneType(type)
    ? "has a `//` comment, which would comment out the code after it in the .d.ts"
    : "is not valid TypeScript";
  recordDiagnostic(
    ctx,
    "type-syntax-error",
    name,
    `Type \`${type}\` of "${name}" ${problem}; falling back to "any".`,
    source,
  );
  return false;
}

/**
 * A JSDoc `{type}` is copied into the `.d.ts` as written, so one that
 * doesn't parse (`{"a" | }`, closure-style `{?string}`) would break the
 * whole file. It's typed `any` instead, with an error diagnostic.
 */
function replaceInvalidTypes(
  ctx: ParserContext,
  props: ComponentProp[],
  events: SerializedComponentEvent[],
  slots: ComponentSlot[],
  typedefs: TypeDef[],
) {
  for (const prop of props) {
    if (prop.typeSource === "jsdoc" && !isValidType(ctx, prop.type, prop.name, prop.source)) prop.type = "any";
  }
  for (const event of events) {
    if (event.type === "dispatched" && !isValidType(ctx, event.detail, event.name, event.source)) event.detail = "any";
  }
  for (const slot of slots) {
    if (!isValidType(ctx, slot.slot_props, slot.name ?? "default", slot.source)) slot.slot_props = "any";
  }
  for (const typedef of typedefs) {
    if (!isValidType(ctx, typedef.type, typedef.name, typedef.source)) {
      typedef.type = "any";
      typedef.ts = `type ${typedef.name} = any;`;
    }
  }
}

/**
 * The dispatcher handed to another function (`helper(dispatch)`). For an
 * imported function, `generateBundle` reads the events it dispatches
 * (see `resolve-dispatch-escapes.ts`), so it's queued for that. Returns the
 * calls to any other callee, which can't be followed.
 */
function queueDispatcherEscapes(ctx: ParserContext, walk: ComponentWalkResult): CallExpression[] {
  const { dispatcherName } = walk;
  const unfollowableEscapes: CallExpression[] = [];
  if (dispatcherName === undefined) return unfollowableEscapes;

  const escapes: Array<{ call: CallExpression; argumentIndex: number; property?: string }> = [];
  for (const call of walk.callsWithArguments) {
    const passed = findDispatcherArgument(call, dispatcherName);
    if (passed) escapes.push({ call, ...passed });
  }
  if (escapes.length > 0) {
    recordSveldIgnore(ctx, "dispatch-escapes", dispatcherName, resolveLocalVarJSDoc(ctx, dispatcherName)?.sveldIgnore);
  }
  const ignored = isSveldIgnored(ctx, "dispatch-escapes", dispatcherName);
  for (const { call, argumentIndex, property } of escapes) {
    const importBinding = walk.locallyBoundCalls.has(call) ? undefined : importedCalleeBinding(ctx, call.callee);
    if (!importBinding) {
      unfollowableEscapes.push(call);
      continue;
    }
    const source = sourceRangeFromNode(ctx, call);
    ctx.pendingDispatchEscapeCandidates.push({
      importSource: importBinding.source,
      importedName: importBinding.importedName,
      ...(importBinding.members ? { members: importBinding.members } : {}),
      calleeText: sourceForExpression(ctx, call.callee) ?? importBinding.importedName,
      dispatcherName,
      argumentIndex,
      ...(property === undefined ? {} : { property }),
      ...(source ? { source } : {}),
      ...(ignored ? { ignored } : {}),
    });
  }
  return unfollowableEscapes;
}

/**
 * `@event` in JSDoc with no `createEventDispatcher`, `on:` forward,
 * or `on<event>` callback prop. While the dispatcher escapes, such an
 * event may come from the function it escapes to: an imported one gets
 * checked once its events are known, anything else gets the benefit of
 * the doubt.
 */
function recordOrphanJsDocEvents(
  ctx: ParserContext,
  actuallyDispatchedEvents: Set<string>,
  unfollowableEscapes: CallExpression[],
) {
  for (const eventName of ctx.jsDocEventNames) {
    if (actuallyDispatchedEvents.has(eventName)) continue;
    if (ctx.forwardedEvents.has(eventName)) continue;
    if (ctx.props.has(`on${eventName}`)) continue;
    if (unfollowableEscapes.length > 0) continue;
    const diagnostic = buildDiagnostic(
      ctx,
      "event-no-source",
      eventName,
      `@event "${eventName}" has no matching dispatch or callback prop.`,
      ctx.jsDocEventSources.get(eventName),
    );
    if (ctx.pendingDispatchEscapeCandidates.length > 0) {
      ctx.deferredEventNoSourceDiagnostics.push(diagnostic);
    } else {
      ctx.diagnosticRecords.push(diagnostic);
    }
  }
}

/**
 * `@slot`/`@snippet` with no `<slot>` or `{@render}` to match, often a
 * description's first word read as the slot name. A declared snippet prop
 * counts, since it may be passed on to a child.
 */
function recordUnrenderedJsDocSlots(ctx: ParserContext) {
  if (ctx.slotsUntracked) return;
  const runes = ctx.syntaxMode === "runes";
  for (const [key, { tag, source }] of ctx.jsDocSlots) {
    const prop = key ?? "children";
    if (ctx.renderedSlots.has(key) || (runes && ctx.props.has(prop))) continue;
    const slotElement = key === DEFAULT_SLOT_NAME ? "default <slot>" : `<slot name="${key}">`;
    const expected = runes ? `{@render ${prop}()} or "${prop}" prop` : slotElement;
    const message =
      key === DEFAULT_SLOT_NAME
        ? `@${tag} documents the default slot, but the component has no ${expected}.`
        : `@${tag} "${key}" has no matching ${expected} in the component.`;
    recordDiagnostic(ctx, "slot-not-rendered", key ?? "default", message, source);
  }
}

/**
 * A public prop/typedef/event/slot/module-export/context-property whose type
 * text still names a now-excluded `@internal` typedef leaves a dangling
 * reference in the generated `.d.ts`. Cheap early-out: most components
 * declare no `@internal` typedefs at all.
 */
function recordInternalTypedefReferences(
  ctx: ParserContext,
  output: {
    props: ComponentProp[];
    moduleExports: ComponentProp[];
    typedefs: TypeDef[];
    events: SerializedComponentEvent[];
    slots: ComponentSlot[];
    contexts: ComponentContext[];
  },
) {
  const internalTypedefNames = output.typedefs
    .filter((typedef) => typedef.internal)
    .map((typedef) => typedef.name.split("<")[0]);

  if (internalTypedefNames.length === 0) return;

  const internalTypedefMatchers = internalTypedefNames.map((name) => ({
    name,
    regex: new RegExp(`\\b${name}\\b`),
  }));

  const scanForInternalReference = (referencingName: string, typeText: string | undefined, source?: SourceRange) => {
    if (!typeText) return;
    for (const { name: internalName, regex } of internalTypedefMatchers) {
      if (!regex.test(typeText)) continue;
      recordDiagnostic(
        ctx,
        "internal-typedef-referenced",
        referencingName,
        `"${referencingName}" references "${internalName}", which is @internal and excluded from output; the generated .d.ts will contain a dangling reference to it.`,
        source,
      );
    }
  };

  for (const prop of output.props) {
    if (prop.internal) continue;
    scanForInternalReference(prop.name, prop.type, prop.source);
  }

  for (const moduleExport of output.moduleExports) {
    if (moduleExport.internal) continue;
    scanForInternalReference(moduleExport.name, moduleExport.type, moduleExport.source);
  }

  for (const typedef of output.typedefs) {
    if (typedef.internal) continue;
    scanForInternalReference(typedef.name, typedef.ts);
  }

  for (const event of output.events) {
    if (event.internal || event.type !== "dispatched") continue;
    scanForInternalReference(event.name, event.detail, event.source);
  }

  for (const slot of output.slots) {
    if (slot.internal) continue;
    scanForInternalReference(slot.name ?? "default", slot.slot_props, slot.source);
  }

  for (const context of output.contexts) {
    if (context.internal) continue;
    if (context.type !== undefined) scanForInternalReference(context.typeName, context.type, context.source);
    for (const property of context.properties) {
      scanForInternalReference(property.name, property.type);
    }
  }
}

/** Builds the parse result from `ctx` and what {@link walkComponent} collected. */
export function finalizeComponent(ctx: ParserContext, walk: ComponentWalkResult): ComponentParseResult {
  const actuallyDispatchedEvents = resolveDispatchedEvents(ctx, walk);

  normalizeRunesCallbackProps(ctx, actuallyDispatchedEvents);

  const props = buildProps(ctx);

  ctx.activeScopes.length = 0;

  const slots = buildSlots(ctx);

  resolveGenerics(ctx, props, slots);

  const moduleExports = mapToArray(ctx.moduleExports);
  const events = serializeEvents(ctx);
  const typedefs = mapToArray(ctx.typedefs);
  const contexts = mapToArray(ctx.contexts);

  recordUnknownPropTypes(ctx, props, moduleExports);
  replaceInvalidTypes(ctx, props, events, slots, typedefs);

  const unfollowableEscapes = queueDispatcherEscapes(ctx, walk);
  recordOrphanJsDocEvents(ctx, actuallyDispatchedEvents, unfollowableEscapes);
  recordUnrenderedJsDocSlots(ctx);

  const { dispatcherName } = walk;
  for (const call of unfollowableEscapes) {
    const callee = sourceForExpression(ctx, call.callee) ?? "";
    recordDiagnostic(
      ctx,
      "dispatch-escapes",
      dispatcherName ?? "",
      `\`${dispatcherName}\` is passed to \`${callee}\`, which sveld can't follow: it only reads a function imported from another module, by name, as its default export, or through a namespace import. Document the events dispatched there with @event tags.`,
      sourceRangeFromNode(ctx, call),
    );
  }

  // Spread only onto components, with no `@restProps` tag: another component's rest-prop shape is unknowable.
  if (ctx.rest_props?.type === "InlineComponent") {
    recordDiagnostic(
      ctx,
      "rest-props-unresolved",
      "$$restProps",
      `$$restProps is only spread onto component "${ctx.rest_props.name}"; sveld cannot infer its rest-prop type. Spread onto a plain element or add an @restProps tag.`,
    );
  }

  recordInternalTypedefReferences(ctx, { props, moduleExports, typedefs, events, slots, contexts });

  const parsedComponent: ParsedComponent = {
    source: sourceRangeFromOffsets(ctx, 0, ctx.source?.length),
    syntaxMode: ctx.syntaxMode,
    ...(ctx.scriptLanguage ? { scriptLanguage: ctx.scriptLanguage } : {}),
    props,
    moduleExports,
    slots,
    events,
    typedefs,
    generics: ctx.generics,
    rest_props: ctx.rest_props,
    extends: ctx.extends,
    componentComment: ctx.componentComment,
    componentCommentSource: ctx.componentCommentSource,
    contexts,
    customElementTag: ctx.customElementTag,
    customElement: ctx.customElement,
    ...(ctx.cssParts.length > 0 ? { cssParts: ctx.cssParts.slice() } : {}),
    ...(ctx.cssProperties.length > 0 ? { cssProperties: ctx.cssProperties.slice() } : {}),
    diagnostics: ctx.diagnosticRecords.slice(),
  };

  const typeScriptMetadata = buildTypeScriptMetadata(ctx);
  if (typeScriptMetadata) parsedComponent[PARSED_COMPONENT_TYPE_SCRIPT_METADATA] = typeScriptMetadata;

  const pending = buildPendingCrossFileCandidates(ctx);
  return pending ? { component: parsedComponent, pending } : { component: parsedComponent };
}
