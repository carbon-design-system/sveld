/**
 * Structural diff and change classification for sveld component APIs.
 *
 * This module is intentionally free of any filesystem, parser, or test-framework
 * dependencies so it can be reused by:
 *
 * - the `sveld/testing` golden-file helper (see `./testing`), and
 * - a future API diff / breaking-change detector.
 *
 * It operates on the normalized {@link ComponentApi} snapshot shape, which is a
 * deterministic, position-free projection of the parsed component metadata.
 */

/**
 * Severity bucket for a single API change.
 *
 * - `breaking` — a consumer of the previous API could break (a member was
 *   removed, a type changed, an optional prop became required, etc.).
 * - `additive` — the surface grew or loosened in a backwards-compatible way
 *   (a new optional prop/slot/event, a required prop became optional, etc.).
 * - `doc-only` — only human-facing documentation changed (descriptions,
 *   the `@component` comment); the type contract is unchanged.
 */
export type ChangeKind = "breaking" | "additive" | "doc-only";

/** The kind of API member a change applies to. */
export type ChangeCategory = "component" | "prop" | "moduleExport" | "slot" | "event" | "typedef" | "meta";

/** A single classified difference between two component API snapshots. */
export interface ApiChange {
  kind: ChangeKind;
  category: ChangeCategory;
  /** The component (module) name the change belongs to. */
  component: string;
  /** The member name (prop/slot/event/typedef), when applicable. */
  member?: string;
  /** Human-readable, single-line description of the change. */
  message: string;
}

/** The result of diffing two component API snapshots. */
export interface ApiDiff {
  /** All changes, in a stable order (breaking, then additive, then doc-only). */
  changes: ApiChange[];
  breaking: ApiChange[];
  additive: ApiChange[];
  docOnly: ApiChange[];
  /** True when the two snapshots are identical (no changes). */
  matches: boolean;
  /**
   * The overall severity of the drift: the most severe change present, or
   * `null` when the snapshots match.
   */
  classification: ChangeKind | null;
}

/** Snapshot format version, bumped if this projection shape changes incompatibly. */
export const SNAPSHOT_VERSION = 1;

/** Normalized prop (or module export) projection used for diffing. */
export interface ComponentApiProp {
  type?: string;
  kind: "let" | "const" | "function";
  constant: boolean;
  isRequired: boolean;
  isFunction: boolean;
  reactive: boolean;
  bindable?: true;
  binding?: "readonly" | "writable";
  value?: string;
  returnType?: string;
  params?: Array<{ name: string; type: string; optional?: boolean; description?: string }>;
  description?: string;
}

/** Normalized slot projection used for diffing. */
export interface ComponentApiSlot {
  default: boolean;
  slot_props?: string;
  fallback?: string;
  description?: string;
}

/** Normalized event projection used for diffing. */
export interface ComponentApiEvent {
  type: "forwarded" | "dispatched";
  detail?: string;
  description?: string;
}

/** Normalized typedef projection used for diffing. */
export interface ComponentApiTypedef {
  ts: string;
  type: string;
  description?: string;
}

/** Normalized single-component projection used for diffing. */
export interface ComponentApiComponent {
  props: Record<string, ComponentApiProp>;
  moduleExports: Record<string, ComponentApiProp>;
  slots: Record<string, ComponentApiSlot>;
  events: Record<string, ComponentApiEvent>;
  typedefs: Record<string, ComponentApiTypedef>;
  /** Whether the component spreads `$$restProps` onto an element/component. */
  rest_props: boolean;
  generics: [name: string, type: string] | null;
  /** Component-level description from the `@component` comment. */
  description?: string;
}

/**
 * Deterministic, position-free projection of a parsed component bundle.
 *
 * This is the value that downstream libraries commit as their golden snapshot.
 * It deliberately omits volatile data (generator version, absolute file paths,
 * source ranges) so the snapshot only changes when the public API changes.
 */
export interface ComponentApi {
  version: number;
  components: Record<string, ComponentApiComponent>;
}

const CHANGE_ORDER: Record<ChangeKind, number> = { breaking: 0, additive: 1, "doc-only": 2 };

function quote(value: unknown): string {
  if (value === undefined) return "(none)";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/** Strict, order-independent structural equality for the small projection values. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (!deepEqual(aKeys, bKeys)) return false;
    return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}

interface PropField {
  key: keyof ComponentApiProp;
  label: string;
  /** Classify a change of this field given the before/after values. */
  classify: (previous: ComponentApiProp, next: ComponentApiProp) => ChangeKind;
}

/**
 * Signature and documentation fields compared for props and module exports,
 * with the classification rule for each.
 */
const PROP_FIELDS: PropField[] = [
  { key: "type", label: "type", classify: () => "breaking" },
  { key: "kind", label: "kind", classify: () => "breaking" },
  { key: "isFunction", label: "function-ness", classify: () => "breaking" },
  { key: "returnType", label: "return type", classify: () => "breaking" },
  { key: "params", label: "parameters", classify: () => "breaking" },
  { key: "value", label: "default value", classify: () => "additive" },
  { key: "reactive", label: "reactivity", classify: () => "additive" },
  {
    // Optional -> required is breaking; required -> optional is a loosening.
    key: "isRequired",
    label: "required",
    classify: (previous, next) => (!previous.isRequired && next.isRequired ? "breaking" : "additive"),
  },
  {
    // Gaining `$bindable()` is additive; losing it removes a capability.
    key: "bindable",
    label: "bindable",
    classify: (previous, next) => (previous.bindable && !next.bindable ? "breaking" : "additive"),
  },
  {
    // writable -> readonly removes a capability; readonly -> writable adds one.
    key: "binding",
    label: "binding direction",
    classify: (previous, next) =>
      previous.binding === "writable" && next.binding === "readonly" ? "breaking" : "additive",
  },
  { key: "constant", label: "constant-ness", classify: () => "additive" },
  { key: "description", label: "description", classify: () => "doc-only" },
];

function diffProps(
  component: string,
  category: "prop" | "moduleExport",
  noun: string,
  previous: Record<string, ComponentApiProp>,
  next: Record<string, ComponentApiProp>,
  changes: ApiChange[],
): void {
  for (const name of memberNames(previous, next)) {
    const before = previous[name];
    const after = next[name];

    if (before && !after) {
      changes.push({ kind: "breaking", category, component, member: name, message: `${noun} \`${name}\` was removed` });
      continue;
    }

    if (!before && after) {
      changes.push({
        kind: after.isRequired ? "breaking" : "additive",
        category,
        component,
        member: name,
        message: after.isRequired ? `required ${noun} \`${name}\` was added` : `${noun} \`${name}\` was added`,
      });
      continue;
    }

    if (!before || !after) continue;

    for (const field of PROP_FIELDS) {
      if (deepEqual(before[field.key], after[field.key])) continue;
      const summary =
        field.key === "params"
          ? `${noun} \`${name}\` ${field.label} changed`
          : `${noun} \`${name}\` ${field.label} changed: ${quote(before[field.key])} → ${quote(after[field.key])}`;
      changes.push({ kind: field.classify(before, after), category, component, member: name, message: summary });
    }
  }
}

function diffSlots(
  component: string,
  previous: Record<string, ComponentApiSlot>,
  next: Record<string, ComponentApiSlot>,
  changes: ApiChange[],
): void {
  for (const name of memberNames(previous, next)) {
    const before = previous[name];
    const after = next[name];

    if (before && !after) {
      changes.push({
        kind: "breaking",
        category: "slot",
        component,
        member: name,
        message: `slot \`${name}\` was removed`,
      });
      continue;
    }
    if (!before && after) {
      changes.push({
        kind: "additive",
        category: "slot",
        component,
        member: name,
        message: `slot \`${name}\` was added`,
      });
      continue;
    }
    if (!before || !after) continue;

    if (!deepEqual(before.slot_props, after.slot_props)) {
      changes.push({
        kind: "breaking",
        category: "slot",
        component,
        member: name,
        message: `slot \`${name}\` props changed: ${quote(before.slot_props)} → ${quote(after.slot_props)}`,
      });
    }
    if (!deepEqual(before.fallback, after.fallback)) {
      changes.push({
        kind: "additive",
        category: "slot",
        component,
        member: name,
        message: `slot \`${name}\` fallback content changed`,
      });
    }
    if (!deepEqual(before.description, after.description)) {
      changes.push({
        kind: "doc-only",
        category: "slot",
        component,
        member: name,
        message: `slot \`${name}\` description changed`,
      });
    }
  }
}

function diffEvents(
  component: string,
  previous: Record<string, ComponentApiEvent>,
  next: Record<string, ComponentApiEvent>,
  changes: ApiChange[],
): void {
  for (const name of memberNames(previous, next)) {
    const before = previous[name];
    const after = next[name];

    if (before && !after) {
      changes.push({
        kind: "breaking",
        category: "event",
        component,
        member: name,
        message: `event \`${name}\` was removed`,
      });
      continue;
    }
    if (!before && after) {
      changes.push({
        kind: "additive",
        category: "event",
        component,
        member: name,
        message: `event \`${name}\` was added`,
      });
      continue;
    }
    if (!before || !after) continue;

    if (before.type !== after.type) {
      changes.push({
        kind: "breaking",
        category: "event",
        component,
        member: name,
        message: `event \`${name}\` kind changed: ${before.type} → ${after.type}`,
      });
    }
    if (!deepEqual(before.detail, after.detail)) {
      changes.push({
        kind: "breaking",
        category: "event",
        component,
        member: name,
        message: `event \`${name}\` detail type changed: ${quote(before.detail)} → ${quote(after.detail)}`,
      });
    }
    if (!deepEqual(before.description, after.description)) {
      changes.push({
        kind: "doc-only",
        category: "event",
        component,
        member: name,
        message: `event \`${name}\` description changed`,
      });
    }
  }
}

function diffTypedefs(
  component: string,
  previous: Record<string, ComponentApiTypedef>,
  next: Record<string, ComponentApiTypedef>,
  changes: ApiChange[],
): void {
  for (const name of memberNames(previous, next)) {
    const before = previous[name];
    const after = next[name];

    if (before && !after) {
      changes.push({
        kind: "breaking",
        category: "typedef",
        component,
        member: name,
        message: `typedef \`${name}\` was removed`,
      });
      continue;
    }
    if (!before && after) {
      changes.push({
        kind: "additive",
        category: "typedef",
        component,
        member: name,
        message: `typedef \`${name}\` was added`,
      });
      continue;
    }
    if (!before || !after) continue;

    if (!deepEqual(before.ts, after.ts)) {
      changes.push({
        kind: "breaking",
        category: "typedef",
        component,
        member: name,
        message: `typedef \`${name}\` changed: ${quote(before.ts)} → ${quote(after.ts)}`,
      });
    }
    if (!deepEqual(before.description, after.description)) {
      changes.push({
        kind: "doc-only",
        category: "typedef",
        component,
        member: name,
        message: `typedef \`${name}\` description changed`,
      });
    }
  }
}

function diffComponent(
  name: string,
  before: ComponentApiComponent,
  after: ComponentApiComponent,
  changes: ApiChange[],
): void {
  diffProps(name, "prop", "prop", before.props, after.props, changes);
  diffProps(name, "moduleExport", "module export", before.moduleExports, after.moduleExports, changes);
  diffSlots(name, before.slots, after.slots, changes);
  diffEvents(name, before.events, after.events, changes);
  diffTypedefs(name, before.typedefs, after.typedefs, changes);

  if (before.rest_props !== after.rest_props) {
    changes.push({
      kind: after.rest_props ? "additive" : "breaking",
      category: "meta",
      component: name,
      message: after.rest_props ? "now spreads `$$restProps`" : "no longer spreads `$$restProps`",
    });
  }
  if (!deepEqual(before.generics, after.generics)) {
    changes.push({
      kind: "breaking",
      category: "meta",
      component: name,
      message: `generics changed: ${quote(before.generics?.join(": "))} → ${quote(after.generics?.join(": "))}`,
    });
  }
  if (!deepEqual(before.description, after.description)) {
    changes.push({ kind: "doc-only", category: "meta", component: name, message: "component description changed" });
  }
}

function memberNames(...records: Array<Record<string, unknown>>): string[] {
  const names = new Set<string>();
  for (const record of records) {
    for (const name of Object.keys(record)) names.add(name);
  }
  return Array.from(names).sort();
}

/**
 * Diffs two normalized component API snapshots and classifies every difference.
 *
 * @param previous - The committed (golden) snapshot.
 * @param next - The freshly generated snapshot.
 * @returns A structured, classified diff.
 *
 * @example
 * ```ts
 * const diff = diffComponentApi(golden, current);
 * if (!diff.matches) {
 *   console.error(formatApiDiff(diff));
 * }
 * ```
 */
export function diffComponentApi(previous: ComponentApi, next: ComponentApi): ApiDiff {
  const changes: ApiChange[] = [];

  for (const name of memberNames(previous.components, next.components)) {
    const before = previous.components[name];
    const after = next.components[name];

    if (before && !after) {
      changes.push({
        kind: "breaking",
        category: "component",
        component: name,
        message: `component \`${name}\` was removed`,
      });
      continue;
    }
    if (!before && after) {
      changes.push({
        kind: "additive",
        category: "component",
        component: name,
        message: `component \`${name}\` was added`,
      });
      continue;
    }
    if (!before || !after) continue;

    diffComponent(name, before, after, changes);
  }

  changes.sort((a, b) => {
    if (CHANGE_ORDER[a.kind] !== CHANGE_ORDER[b.kind]) return CHANGE_ORDER[a.kind] - CHANGE_ORDER[b.kind];
    if (a.component !== b.component) return a.component.localeCompare(b.component);
    return (a.member ?? "").localeCompare(b.member ?? "");
  });

  const breaking = changes.filter((change) => change.kind === "breaking");
  const additive = changes.filter((change) => change.kind === "additive");
  const docOnly = changes.filter((change) => change.kind === "doc-only");

  let classification: ChangeKind | null = null;
  if (breaking.length > 0) classification = "breaking";
  else if (additive.length > 0) classification = "additive";
  else if (docOnly.length > 0) classification = "doc-only";

  return { changes, breaking, additive, docOnly, matches: changes.length === 0, classification };
}

const KIND_LABEL: Record<ChangeKind, string> = {
  breaking: "BREAKING",
  additive: "ADDITIVE",
  "doc-only": "DOC-ONLY",
};

const KIND_MARKER: Record<ChangeKind, string> = {
  breaking: "✖",
  additive: "+",
  "doc-only": "~",
};

/**
 * Renders a classified diff as a readable, multi-line report suitable for a
 * test failure message.
 *
 * @example
 * ```text
 * Component API drift detected (2 changes: 1 breaking, 1 doc-only).
 *
 * BREAKING
 *   ✖ Button: prop `size` type changed: "small" | "large" → "sm" | "lg"
 *
 * DOC-ONLY
 *   ~ Button: component description changed
 * ```
 */
export function formatApiDiff(diff: ApiDiff): string {
  if (diff.matches) return "Component API matches the golden snapshot.";

  const counts = [
    diff.breaking.length ? `${diff.breaking.length} breaking` : null,
    diff.additive.length ? `${diff.additive.length} additive` : null,
    diff.docOnly.length ? `${diff.docOnly.length} doc-only` : null,
  ].filter((part): part is string => part !== null);

  const total = diff.changes.length;
  const lines: string[] = [
    `Component API drift detected (${total} change${total === 1 ? "" : "s"}: ${counts.join(", ")}).`,
  ];

  for (const kind of ["breaking", "additive", "doc-only"] as const) {
    const group = diff.changes.filter((change) => change.kind === kind);
    if (group.length === 0) continue;
    lines.push("", KIND_LABEL[kind]);
    for (const change of group) {
      const location = change.member ? `${change.component}` : change.component;
      lines.push(`  ${KIND_MARKER[kind]} ${location}: ${change.message}`);
    }
  }

  return lines.join("\n");
}
