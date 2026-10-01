import { dirname } from "node:path";
import type { Expression, Node, Pattern, SpreadElement, TSParameterProperty } from "sveast";
import { resolveStaticStringLiteral } from "./ast-guards";
import type { ComponentDocApi } from "./bundle";
import type { CrossFilePass } from "./cross-file-pass";
import { createDiagnostic } from "./diagnostics";
import type {
  DispatchedEvent,
  PendingCrossFileCandidates,
  PendingDispatchEscapeCandidate,
  SerializedComponentEvent,
} from "./model";
import { type ExportedFunction, findImportedExport, type ResolveContext } from "./module-exports";
import { compareSerializedEvents } from "./parser/event-order";
import type { DetailTypeSource } from "./parser/events";
import { walkNodes } from "./parser/walk";
import { getParserStack } from "./parser-stack";

export type DispatchEscapeFailureReason =
  | "module-not-found"
  | "not-a-function"
  | "parameter-not-found"
  | "dynamic-event-name"
  | "passed-on";

/** An event the helper dispatches through the component's dispatcher. */
export interface HelperDispatchedEvent {
  name: string;
  detail: string;
}

export interface DispatchEscapeResolution {
  candidate: PendingDispatchEscapeCandidate;
  /** Present on success. */
  events?: HelperDispatchedEvent[];
  /** Present on failure. */
  failureReason?: DispatchEscapeFailureReason;
}

/** How the helper refers to the dispatcher: a parameter, or a property of one (`options.dispatch`). */
type DispatcherBinding = { name: string } | { object: string; property: string };

/**
 * Read the function each candidate passes its dispatcher to
 * ({@link findImportedExport} follows re-exports and namespace exports)
 * and collect the events it dispatches: every call through the receiving
 * parameter must name its event with a string literal, or a conditional
 * between them. A dispatcher the function passes on, or a name computed at
 * runtime, leaves the candidate unresolved. AST only, no `tsc`.
 */
export function resolveDispatchEscapeCandidates(
  componentFilePath: string,
  candidates: PendingDispatchEscapeCandidate[],
  ctx: ResolveContext,
): DispatchEscapeResolution[] {
  const fromDir = dirname(componentFilePath);

  return candidates.map((candidate): DispatchEscapeResolution => {
    const resolvedFile = ctx.graph.resolve(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate, failureReason: "module-not-found" };

    const fn = findImportedExport(resolvedFile, candidate, ctx)?.functionNode;
    if (!fn) return { candidate, failureReason: "not-a-function" };

    const binding = dispatcherBinding(fn, candidate);
    if (!binding) return { candidate, failureReason: "parameter-not-found" };

    return collectDispatchedEvents(fn, binding, candidate);
  });
}

/** `param = fallback` → `param`. */
function withoutDefault(node: Pattern | TSParameterProperty | undefined): Pattern | TSParameterProperty | undefined {
  return node?.type === "AssignmentPattern" ? node.left : node;
}

function dispatcherBinding(
  fn: ExportedFunction,
  candidate: PendingDispatchEscapeCandidate,
): DispatcherBinding | undefined {
  const param = withoutDefault(fn.params[candidate.argumentIndex]);

  if (candidate.property === undefined) return param?.type === "Identifier" ? { name: param.name } : undefined;
  if (!candidate.property) return undefined;

  if (param?.type === "Identifier") return { object: param.name, property: candidate.property };
  if (param?.type !== "ObjectPattern") return undefined;

  for (const property of param.properties) {
    if (property.type !== "Property" || property.computed) continue;
    if (property.key.type !== "Identifier" || property.key.name !== candidate.property) continue;
    const value = withoutDefault(property.value);
    return value?.type === "Identifier" ? { name: value.name } : undefined;
  }
  return undefined;
}

/** Event names a `dispatch(...)` first argument can take, or `null` when one isn't static. */
function staticEventNames(node: Expression | SpreadElement | undefined): string[] | null {
  if (!node) return null;
  if (node.type === "ConditionalExpression") {
    const consequent = staticEventNames(node.consequent);
    const alternate = staticEventNames(node.alternate);
    return consequent && alternate ? [...consequent, ...alternate] : null;
  }
  const name = resolveStaticStringLiteral(node);
  return name ? [name] : null;
}

/** Literal detail inference inside a helper: its locals aren't typed, so an identifier member is `any`. */
const helperDetailTypeSource: DetailTypeSource = {
  variableType: () => undefined,
};

/**
 * Detail type of one `dispatch(name, detail)` call, inferred as a
 * same-file dispatch's is: object and array literals structurally, other
 * literals as their value. Anything else is `any`.
 */
function detailType(node: Expression | SpreadElement | undefined): string {
  if (!node) return "null";
  const { deriveLiteralDetailType, literalDetailToTypeText } = getParserStack();
  if (node.type === "Literal") return literalDetailToTypeText(node.value);
  return deriveLiteralDetailType(helperDetailTypeSource, node) ?? "any";
}

function isDispatcherCallee(node: Node, binding: DispatcherBinding): boolean {
  if ("name" in binding) return node.type === "Identifier" && node.name === binding.name;
  if (node.type !== "MemberExpression" || node.computed) return false;
  return (
    node.object.type === "Identifier" &&
    node.object.name === binding.object &&
    node.property.type === "Identifier" &&
    node.property.name === binding.property
  );
}

function collectDispatchedEvents(
  fn: ExportedFunction,
  binding: DispatcherBinding,
  candidate: PendingDispatchEscapeCandidate,
): DispatchEscapeResolution {
  const body = fn.body;

  const detailsByName = new Map<string, Set<string>>();
  const referenceName = "name" in binding ? binding.name : binding.object;
  let failureReason: DispatchEscapeFailureReason | undefined;

  walkNodes<Node>(body, (node, parent, prop) => {
    if (failureReason) return;

    if (node.type === "CallExpression") {
      if (!isDispatcherCallee(node.callee, binding)) return;
      const args = node.arguments;
      const names = staticEventNames(args[0]);
      if (!names) {
        failureReason = "dynamic-event-name";
        return;
      }
      for (const name of names) {
        const details = detailsByName.get(name) ?? new Set<string>();
        details.add(detailType(args[1]));
        detailsByName.set(name, details);
      }
      return;
    }

    const isCallee = parent?.type === "CallExpression" && prop === "callee";
    if (node.type === "MemberExpression" && isDispatcherCallee(node, binding) && !isCallee) {
      failureReason = "passed-on";
      return;
    }

    if (node.type !== "Identifier" || node.name !== referenceName) return;
    if (isCallee) return;
    // `options.anything`: `options.dispatch` itself was checked above.
    if (!("name" in binding) && parent?.type === "MemberExpression" && prop === "object") return;
    // `x.dispatch` or `{ dispatch: ... }` names something else.
    if (parent?.type === "MemberExpression" && prop === "property" && !parent.computed) return;
    if (parent?.type === "Property" && prop === "key" && !parent.computed) return;
    // Any other use (an argument, a stored reference) may dispatch out of sight.
    failureReason = "passed-on";
  });

  if (failureReason) return { candidate, failureReason };

  const events = Array.from(detailsByName, ([name, details]): HelperDispatchedEvent => {
    const types = Array.from(details);
    return { name, detail: types.includes("any") ? "any" : types.join(" | ") };
  });
  return { candidate, events };
}

/** Why the helper's events couldn't be read, completing "sveld couldn't read the events it dispatches: ...". */
export function describeDispatchEscapeFailure(
  candidate: PendingDispatchEscapeCandidate,
  reason: DispatchEscapeFailureReason,
): string {
  const helper = candidate.members
    ? `"${candidate.calleeText}"`
    : candidate.importedName === "default"
      ? "the default export"
      : `"${candidate.importedName}"`;
  switch (reason) {
    case "module-not-found":
      return `"${candidate.importSource}" isn't a local module sveld can read`;
    case "not-a-function":
      return `${helper} isn't a function declared in "${candidate.importSource}"`;
    case "parameter-not-found":
      return `no parameter of ${helper} receives it`;
    case "dynamic-event-name":
      return "an event name isn't a string literal";
    case "passed-on":
      return `${helper} passes it on`;
  }
}

/**
 * Add the events each helper dispatches, unless the component already
 * dispatches one by that name (its `@event` tag wins). A helper event
 * replaces a forwarded event of the same name. A helper sveld couldn't read
 * gets a `dispatch-escapes` diagnostic. The held-back `event-no-source`
 * diagnostics come back only when every helper was read and none of them
 * dispatches the event.
 */
function applyDispatchEscapeResolutions(
  component: ComponentDocApi,
  resolutions: DispatchEscapeResolution[],
  {
    deferredEventNoSourceDiagnostics: deferredEventNoSource = [],
    untypedJsDocEventNames: untypedEventNames = [],
  }: PendingCrossFileCandidates,
): void {
  const helperEvents = new Map<string, DispatchedEvent>();
  const diagnostics = [...(component.diagnostics ?? [])];
  let everyHelperRead = true;

  for (const { candidate, events, failureReason } of resolutions) {
    if (failureReason) {
      everyHelperRead = false;
      diagnostics.push(
        createDiagnostic({
          component: component.filePath,
          kind: "dispatch-escapes",
          name: candidate.dispatcherName,
          message: `\`${candidate.dispatcherName}\` is passed to \`${candidate.calleeText}\`, but sveld couldn't read the events it dispatches: ${describeDispatchEscapeFailure(candidate, failureReason)}. Document them with @event tags.`,
          ...(candidate.source ? { source: candidate.source } : {}),
          ...(candidate.ignored ? { ignored: true } : {}),
        }),
      );
      continue;
    }
    for (const event of events ?? []) {
      if (helperEvents.has(event.name)) continue;
      helperEvents.set(event.name, {
        type: "dispatched",
        name: event.name,
        detail: event.detail,
        ...(candidate.source ? { source: candidate.source } : {}),
      });
    }
  }

  if (everyHelperRead) {
    for (const diagnostic of deferredEventNoSource) {
      if (!helperEvents.has(diagnostic.name)) diagnostics.push(diagnostic);
    }
  }
  component.diagnostics = diagnostics;

  if (helperEvents.size === 0) return;

  // As with a same-file dispatch (`addDispatchedEvent`), the forwarded
  // entry's `@event` metadata, detail included, carries over.
  const forwardedByName = new Map<string, SerializedComponentEvent>();
  const dispatchedNames = new Set<string>();
  for (const event of component.events) {
    if (event.type === "dispatched") dispatchedNames.add(event.name);
    else if (!forwardedByName.has(event.name)) forwardedByName.set(event.name, event);
  }

  // An untyped `@event`'s `null` detail is only a fallback, as for a same-file dispatch.
  const untypedNames = new Set(untypedEventNames);
  const detailByUntypedName = new Map<string, string>();
  const added: DispatchedEvent[] = [];
  for (const helperEvent of helperEvents.values()) {
    if (dispatchedNames.has(helperEvent.name)) {
      if (untypedNames.has(helperEvent.name) && helperEvent.detail !== undefined) {
        detailByUntypedName.set(helperEvent.name, helperEvent.detail);
      }
      continue;
    }
    const forwarded = forwardedByName.get(helperEvent.name);
    if (!forwarded) {
      added.push(helperEvent);
      continue;
    }
    const source = helperEvent.source ?? forwarded.source;
    added.push({
      type: "dispatched",
      name: helperEvent.name,
      detail: forwarded.detail ?? helperEvent.detail,
      ...(forwarded.description ? { description: forwarded.description } : {}),
      ...(forwarded.deprecated === undefined ? {} : { deprecated: forwarded.deprecated }),
      ...(forwarded.tags ? { tags: forwarded.tags } : {}),
      ...(forwarded.internal ? { internal: true as const } : {}),
      ...(source ? { source } : {}),
    });
  }
  if (added.length === 0 && detailByUntypedName.size === 0) return;

  const replacedNames = new Set(added.map((event) => event.name));
  component.events = [
    ...component.events
      .filter((event) => event.type === "dispatched" || !replacedNames.has(event.name))
      .map((event) => {
        const detail = event.type === "dispatched" ? detailByUntypedName.get(event.name) : undefined;
        return detail === undefined ? event : { ...event, detail };
      }),
    ...added,
  ].sort(compareSerializedEvents);
}

/** Adds the events a component's dispatcher is passed to an imported helper to dispatch. */
export const dispatchEscapesPass: CrossFilePass<PendingDispatchEscapeCandidate, DispatchEscapeResolution> = {
  collect: (pending) => pending.pendingDispatchEscapeCandidates ?? [],
  resolve: resolveDispatchEscapeCandidates,
  apply: applyDispatchEscapeResolutions,
};
