import { dirname } from "node:path";
import { isIdentifier, isLiteral, resolveStaticStringLiteral } from "./ast-guards";
import type { PendingDispatchEscapeCandidate } from "./ComponentParser";
import { type AstNode, findModuleExportPath, type ResolveContext, resolveModuleFile } from "./parse-entry-exports";
import { type DetailTypeSource, deriveLiteralDetailType, literalDetailToTypeText } from "./parser/events";
import { type WalkableNode, walkNodes } from "./parser/walk";

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
 * ({@link findModuleExportPath} follows re-exports and namespace exports)
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
    const resolvedFile = resolveModuleFile(candidate.importSource, fromDir);
    if (!resolvedFile) return { candidate, failureReason: "module-not-found" };

    const names = [candidate.importedName, ...(candidate.members ?? [])];
    const fn = findModuleExportPath(resolvedFile, names, ctx)?.functionNode;
    if (!fn) return { candidate, failureReason: "not-a-function" };

    const binding = dispatcherBinding(fn, candidate);
    if (!binding) return { candidate, failureReason: "parameter-not-found" };

    return collectDispatchedEvents(fn, binding, candidate);
  });
}

function asNode(value: unknown): AstNode | undefined {
  return value && typeof value === "object" ? (value as AstNode) : undefined;
}

/** `param = fallback` → `param`. */
function withoutDefault(node: AstNode | undefined): AstNode | undefined {
  return node?.type === "AssignmentPattern" ? asNode(node.left) : node;
}

function dispatcherBinding(fn: AstNode, candidate: PendingDispatchEscapeCandidate): DispatcherBinding | undefined {
  const params = Array.isArray(fn.params) ? fn.params : [];
  const param = withoutDefault(asNode(params[candidate.argumentIndex]));

  if (candidate.property === undefined) return isIdentifier(param) ? { name: param.name } : undefined;
  if (!candidate.property) return undefined;

  if (isIdentifier(param)) return { object: param.name, property: candidate.property };
  if (param?.type !== "ObjectPattern" || !Array.isArray(param.properties)) return undefined;

  for (const property of param.properties as AstNode[]) {
    if (property.type !== "Property" || property.computed) continue;
    const key = asNode(property.key);
    if (!isIdentifier(key) || key.name !== candidate.property) continue;
    const value = withoutDefault(asNode(property.value));
    return isIdentifier(value) ? { name: value.name } : undefined;
  }
  return undefined;
}

/** Event names a `dispatch(...)` first argument can take, or `null` when one isn't static. */
function staticEventNames(node: AstNode | undefined): string[] | null {
  if (!node) return null;
  if (node.type === "ConditionalExpression") {
    const consequent = staticEventNames(asNode(node.consequent));
    const alternate = staticEventNames(asNode(node.alternate));
    return consequent && alternate ? [...consequent, ...alternate] : null;
  }
  const name = resolveStaticStringLiteral(node);
  return name ? [name] : null;
}

/** Literal detail inference inside a helper: its locals aren't typed, so an identifier member is `any`. */
const helperDetailTypeSource: DetailTypeSource = {
  variableType: () => undefined,
  getPropertyName: (key) => {
    if (isIdentifier(key)) return key.name;
    return isLiteral(key) && key.value != null ? String(key.value) : undefined;
  },
};

/**
 * Detail type of one `dispatch(name, detail)` call, inferred as a
 * same-file dispatch's is: object and array literals structurally, other
 * literals as their value. Anything else is `any`.
 */
function detailType(node: AstNode | undefined): string {
  if (!node) return "null";
  const structural = deriveLiteralDetailType(helperDetailTypeSource, node);
  if (structural !== undefined) return structural;
  if (node.type === "Literal") return literalDetailToTypeText(node.value);
  return "any";
}

function isDispatcherCallee(node: WalkableNode, binding: DispatcherBinding): boolean {
  if ("name" in binding) return node.type === "Identifier" && node.name === binding.name;
  if (node.type !== "MemberExpression" || node.computed) return false;
  const object = asNode(node.object);
  const property = asNode(node.property);
  return (
    isIdentifier(object) &&
    object.name === binding.object &&
    isIdentifier(property) &&
    property.name === binding.property
  );
}

function collectDispatchedEvents(
  fn: AstNode,
  binding: DispatcherBinding,
  candidate: PendingDispatchEscapeCandidate,
): DispatchEscapeResolution {
  const body = asNode(fn.body);
  if (!body) return { candidate, events: [] };

  const detailsByName = new Map<string, Set<string>>();
  const referenceName = "name" in binding ? binding.name : binding.object;
  let failureReason: DispatchEscapeFailureReason | undefined;

  walkNodes(body as WalkableNode, (node, parent, prop) => {
    if (failureReason) return;

    if (node.type === "CallExpression") {
      const callee = asNode(node.callee);
      if (!callee || !isDispatcherCallee(callee as WalkableNode, binding)) return;
      const args = Array.isArray(node.arguments) ? (node.arguments as AstNode[]) : [];
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
