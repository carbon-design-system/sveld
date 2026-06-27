/**
 * Diff two `COMPONENT_API.json` snapshots and classify each change as
 * **breaking**, **additive**, or **doc-only**.
 *
 * The stable, deterministically-sorted shape emitted by sveld (with a
 * `schemaVersion` and generator metadata) makes it possible to compare two
 * API snapshots and gate CI on breaking changes or generate changelogs.
 *
 * This module is intentionally free of any filesystem access so it can be
 * reused in any environment; the CLI is responsible for reading files.
 */

/** Severity bucket assigned to each detected change. */
export type DiffSeverity = "breaking" | "additive" | "doc-only";

/** Specific kind of change, useful for changelog grouping and tooling. */
export type DiffChangeKind =
  | "component-removed"
  | "component-added"
  | "prop-removed"
  | "prop-added"
  | "prop-renamed"
  | "prop-type-narrowed"
  | "prop-type-widened"
  | "prop-type-changed"
  | "prop-required-added"
  | "prop-optional"
  | "prop-doc-changed"
  | "event-removed"
  | "event-added"
  | "event-detail-changed"
  | "event-doc-changed"
  | "slot-removed"
  | "slot-added"
  | "slot-props-changed"
  | "slot-doc-changed";

/** A single classified difference between two snapshots. */
export interface DiffChange {
  severity: DiffSeverity;
  kind: DiffChangeKind;
  /** The component (moduleName) the change belongs to. */
  component: string;
  /** Prop / event / slot name the change targets, when applicable. */
  target?: string;
  /** Human-readable explanation of the change. */
  message: string;
  /** Previous value (type, description, name, ...), when applicable. */
  from?: string;
  /** New value (type, description, name, ...), when applicable. */
  to?: string;
}

/** Aggregated counts per severity. */
export interface DiffSummary {
  breaking: number;
  additive: number;
  docOnly: number;
  total: number;
}

/** Result of {@link diffComponentApi}. */
export interface DiffResult {
  /** All detected changes, ordered deterministically. */
  changes: DiffChange[];
  summary: DiffSummary;
  /** True when at least one breaking change was detected. */
  hasBreaking: boolean;
}

/** Options controlling diff behavior. */
export interface DiffOptions {
  /**
   * Treat a prop being added or renamed as a rename when the candidate
   * props share the same TypeScript type. Enabled by default.
   */
  detectRenames?: boolean;
}

// --- Minimal structural types for the parts of COMPONENT_API.json we read ---

interface ApiProp {
  name: string;
  type?: string;
  isRequired?: boolean;
  isFunction?: boolean;
  kind?: string;
  description?: string;
}

interface ApiEvent {
  name: string;
  type?: string;
  detail?: string;
  description?: string;
}

interface ApiSlot {
  name?: string | null;
  default?: boolean;
  slot_props?: string;
  description?: string;
}

interface ApiComponent {
  moduleName: string;
  props?: ApiProp[];
  events?: ApiEvent[];
  slots?: ApiSlot[];
}

/** Shape of a parsed `COMPONENT_API.json` file. */
export interface ComponentApiFile {
  schemaVersion?: number;
  components?: ApiComponent[];
}

const SLOT_DEFAULT_KEY = "__default__";

/**
 * Split a TypeScript type into its top-level union members, ignoring `|`
 * that appear inside brackets, parentheses, or string literals.
 *
 * @example
 * splitUnion('"a" | "b" | "c"') // ['"a"', '"b"', '"c"']
 * splitUnion('Array<A | B> | C') // ['Array<A | B>', 'C']
 */
function splitUnion(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let current = "";

  for (let i = 0; i < type.length; i++) {
    const ch = type[i];

    if (quote !== null) {
      current += ch;
      if (ch === "\\") {
        current += type[++i] ?? "";
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") depth--;

    if (ch === "|" && depth === 0) {
      members.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim() !== "") members.push(current.trim());
  return members.filter(Boolean);
}

type TypeComparison = "same" | "narrowed" | "widened" | "changed";

const TOP_TYPES = new Set(["any", "unknown"]);

/**
 * Compare an old and new type string and classify the relationship from the
 * consumer's perspective: a smaller set of accepted values is **narrowed**
 * (breaking), a larger set is **widened** (additive).
 */
function compareTypes(oldType: string, newType: string): TypeComparison {
  const a = oldType.trim();
  const b = newType.trim();
  if (a === b) return "same";

  // `any`/`unknown` accept everything. Going to a top type widens; leaving a
  // top type for something specific narrows.
  const aTop = TOP_TYPES.has(a);
  const bTop = TOP_TYPES.has(b);
  if (aTop && !bTop) return "narrowed";
  if (!aTop && bTop) return "widened";

  const oldMembers = new Set(splitUnion(a));
  const newMembers = new Set(splitUnion(b));

  const oldSubsetOfNew = [...oldMembers].every((m) => newMembers.has(m));
  const newSubsetOfOld = [...newMembers].every((m) => oldMembers.has(m));

  if (oldSubsetOfNew && !newSubsetOfOld) return "widened";
  if (newSubsetOfOld && !oldSubsetOfNew) return "narrowed";
  return "changed";
}

function indexByName<T extends { name: string }>(items: T[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items ?? []) map.set(item.name, item);
  return map;
}

function slotKey(slot: ApiSlot): string {
  return slot.name == null ? SLOT_DEFAULT_KEY : slot.name;
}

function slotLabel(slot: ApiSlot): string {
  return slot.name == null ? "default" : slot.name;
}

function normalizeDescription(value?: string): string {
  return (value ?? "").trim();
}

/**
 * Compare two props that exist in both snapshots and push any classified
 * changes (type, required, doc) onto `changes`.
 */
function diffProp(component: string, oldProp: ApiProp, newProp: ApiProp, changes: DiffChange[]): void {
  const name = newProp.name;

  // Required transitions.
  const wasRequired = oldProp.isRequired === true;
  const isRequired = newProp.isRequired === true;
  if (!wasRequired && isRequired) {
    changes.push({
      severity: "breaking",
      kind: "prop-required-added",
      component,
      target: name,
      message: `Prop "${name}" became required`,
    });
  } else if (wasRequired && !isRequired) {
    changes.push({
      severity: "additive",
      kind: "prop-optional",
      component,
      target: name,
      message: `Prop "${name}" is no longer required`,
    });
  }

  // Type transitions (only when both sides declare a type).
  if (oldProp.type != null && newProp.type != null) {
    const comparison = compareTypes(oldProp.type, newProp.type);
    if (comparison === "narrowed") {
      changes.push({
        severity: "breaking",
        kind: "prop-type-narrowed",
        component,
        target: name,
        message: `Prop "${name}" type narrowed`,
        from: oldProp.type,
        to: newProp.type,
      });
    } else if (comparison === "widened") {
      changes.push({
        severity: "additive",
        kind: "prop-type-widened",
        component,
        target: name,
        message: `Prop "${name}" type widened`,
        from: oldProp.type,
        to: newProp.type,
      });
    } else if (comparison === "changed") {
      changes.push({
        severity: "breaking",
        kind: "prop-type-changed",
        component,
        target: name,
        message: `Prop "${name}" type changed`,
        from: oldProp.type,
        to: newProp.type,
      });
    }
  }

  // Description-only change.
  const oldDesc = normalizeDescription(oldProp.description);
  const newDesc = normalizeDescription(newProp.description);
  if (oldDesc !== newDesc) {
    changes.push({
      severity: "doc-only",
      kind: "prop-doc-changed",
      component,
      target: name,
      message: `Prop "${name}" description changed`,
      from: oldProp.description,
      to: newProp.description,
    });
  }
}

/**
 * Pair up removed and added props that share an identical type signature as
 * renames. Returns the matched pairs and the leftover removed/added props.
 */
function matchRenames(
  removed: ApiProp[],
  added: ApiProp[],
): { renames: Array<[ApiProp, ApiProp]>; removed: ApiProp[]; added: ApiProp[] } {
  const renames: Array<[ApiProp, ApiProp]> = [];
  const remainingRemoved: ApiProp[] = [];
  const usedAdded = new Set<ApiProp>();

  for (const oldProp of removed) {
    if (oldProp.type == null) {
      remainingRemoved.push(oldProp);
      continue;
    }
    const match = added.find(
      (newProp) =>
        !usedAdded.has(newProp) &&
        newProp.type != null &&
        compareTypes(oldProp.type as string, newProp.type) === "same" &&
        (oldProp.isRequired === true) === (newProp.isRequired === true),
    );
    if (match) {
      usedAdded.add(match);
      renames.push([oldProp, match]);
    } else {
      remainingRemoved.push(oldProp);
    }
  }

  const remainingAdded = added.filter((newProp) => !usedAdded.has(newProp));
  return { renames, removed: remainingRemoved, added: remainingAdded };
}

function diffProps(
  component: string,
  oldProps: ApiProp[],
  newProps: ApiProp[],
  options: DiffOptions,
  changes: DiffChange[],
): void {
  const oldByName = indexByName(oldProps);
  const newByName = indexByName(newProps);

  const removed: ApiProp[] = [];
  for (const oldProp of oldProps) {
    if (!newByName.has(oldProp.name)) removed.push(oldProp);
  }

  const added: ApiProp[] = [];
  for (const newProp of newProps) {
    if (!oldByName.has(newProp.name)) added.push(newProp);
  }

  // Props present in both: compare attributes.
  for (const newProp of newProps) {
    const oldProp = oldByName.get(newProp.name);
    if (oldProp) diffProp(component, oldProp, newProp, changes);
  }

  let pendingRemoved = removed;
  let pendingAdded = added;

  if (options.detectRenames !== false) {
    const result = matchRenames(removed, added);
    for (const [oldProp, newProp] of result.renames) {
      changes.push({
        severity: "breaking",
        kind: "prop-renamed",
        component,
        target: newProp.name,
        message: `Prop "${oldProp.name}" renamed to "${newProp.name}"`,
        from: oldProp.name,
        to: newProp.name,
      });
    }
    pendingRemoved = result.removed;
    pendingAdded = result.added;
  }

  for (const oldProp of pendingRemoved) {
    changes.push({
      severity: "breaking",
      kind: "prop-removed",
      component,
      target: oldProp.name,
      message: `Prop "${oldProp.name}" was removed`,
    });
  }

  for (const newProp of pendingAdded) {
    if (newProp.isRequired === true) {
      changes.push({
        severity: "breaking",
        kind: "prop-required-added",
        component,
        target: newProp.name,
        message: `New required prop "${newProp.name}" was added`,
      });
    } else {
      changes.push({
        severity: "additive",
        kind: "prop-added",
        component,
        target: newProp.name,
        message: `New optional prop "${newProp.name}" was added`,
      });
    }
  }
}

function diffEvents(component: string, oldEvents: ApiEvent[], newEvents: ApiEvent[], changes: DiffChange[]): void {
  const oldByName = indexByName(oldEvents);
  const newByName = indexByName(newEvents);

  for (const oldEvent of oldEvents) {
    if (!newByName.has(oldEvent.name)) {
      changes.push({
        severity: "breaking",
        kind: "event-removed",
        component,
        target: oldEvent.name,
        message: `Event "${oldEvent.name}" was removed`,
      });
    }
  }

  for (const newEvent of newEvents) {
    const oldEvent = oldByName.get(newEvent.name);
    if (!oldEvent) {
      changes.push({
        severity: "additive",
        kind: "event-added",
        component,
        target: newEvent.name,
        message: `Event "${newEvent.name}" was added`,
      });
      continue;
    }

    const oldDetail = (oldEvent.detail ?? "").trim();
    const newDetail = (newEvent.detail ?? "").trim();
    if (oldDetail !== newDetail) {
      changes.push({
        severity: "breaking",
        kind: "event-detail-changed",
        component,
        target: newEvent.name,
        message: `Event "${newEvent.name}" detail type changed`,
        from: oldEvent.detail,
        to: newEvent.detail,
      });
    }

    const oldDesc = normalizeDescription(oldEvent.description);
    const newDesc = normalizeDescription(newEvent.description);
    if (oldDesc !== newDesc) {
      changes.push({
        severity: "doc-only",
        kind: "event-doc-changed",
        component,
        target: newEvent.name,
        message: `Event "${newEvent.name}" description changed`,
        from: oldEvent.description,
        to: newEvent.description,
      });
    }
  }
}

function diffSlots(component: string, oldSlots: ApiSlot[], newSlots: ApiSlot[], changes: DiffChange[]): void {
  const oldByKey = new Map(oldSlots.map((slot) => [slotKey(slot), slot]));
  const newByKey = new Map(newSlots.map((slot) => [slotKey(slot), slot]));

  for (const oldSlot of oldSlots) {
    if (!newByKey.has(slotKey(oldSlot))) {
      changes.push({
        severity: "breaking",
        kind: "slot-removed",
        component,
        target: slotLabel(oldSlot),
        message: `Slot "${slotLabel(oldSlot)}" was removed`,
      });
    }
  }

  for (const newSlot of newSlots) {
    const oldSlot = oldByKey.get(slotKey(newSlot));
    if (!oldSlot) {
      changes.push({
        severity: "additive",
        kind: "slot-added",
        component,
        target: slotLabel(newSlot),
        message: `Slot "${slotLabel(newSlot)}" was added`,
      });
      continue;
    }

    const oldProps = (oldSlot.slot_props ?? "").trim();
    const newProps = (newSlot.slot_props ?? "").trim();
    if (oldProps !== newProps) {
      changes.push({
        severity: "breaking",
        kind: "slot-props-changed",
        component,
        target: slotLabel(newSlot),
        message: `Slot "${slotLabel(newSlot)}" props changed`,
        from: oldSlot.slot_props,
        to: newSlot.slot_props,
      });
    }

    const oldDesc = normalizeDescription(oldSlot.description);
    const newDesc = normalizeDescription(newSlot.description);
    if (oldDesc !== newDesc) {
      changes.push({
        severity: "doc-only",
        kind: "slot-doc-changed",
        component,
        target: slotLabel(newSlot),
        message: `Slot "${slotLabel(newSlot)}" description changed`,
        from: oldSlot.description,
        to: newSlot.description,
      });
    }
  }
}

function indexComponents(file: ComponentApiFile): Map<string, ApiComponent> {
  const map = new Map<string, ApiComponent>();
  for (const component of file.components ?? []) map.set(component.moduleName, component);
  return map;
}

const SEVERITY_ORDER: Record<DiffSeverity, number> = { breaking: 0, additive: 1, "doc-only": 2 };

/**
 * Compare two parsed `COMPONENT_API.json` snapshots and classify every change.
 *
 * @param oldApi - The baseline snapshot (e.g. the published API).
 * @param newApi - The candidate snapshot (e.g. the current branch).
 * @param options - Optional behavior overrides.
 * @returns A {@link DiffResult} with classified changes and summary counts.
 *
 * @example
 * ```ts
 * const result = diffComponentApi(oldApi, newApi);
 * if (result.hasBreaking) process.exit(1);
 * ```
 */
export function diffComponentApi(
  oldApi: ComponentApiFile,
  newApi: ComponentApiFile,
  options: DiffOptions = {},
): DiffResult {
  const changes: DiffChange[] = [];
  const oldComponents = indexComponents(oldApi);
  const newComponents = indexComponents(newApi);

  // Removed components.
  for (const [name] of oldComponents) {
    if (!newComponents.has(name)) {
      changes.push({
        severity: "breaking",
        kind: "component-removed",
        component: name,
        message: `Component "${name}" was removed`,
      });
    }
  }

  // Added components and per-component diffs.
  for (const [name, newComponent] of newComponents) {
    const oldComponent = oldComponents.get(name);
    if (!oldComponent) {
      changes.push({
        severity: "additive",
        kind: "component-added",
        component: name,
        message: `Component "${name}" was added`,
      });
      continue;
    }

    diffProps(name, oldComponent.props ?? [], newComponent.props ?? [], options, changes);
    diffEvents(name, oldComponent.events ?? [], newComponent.events ?? [], changes);
    diffSlots(name, oldComponent.slots ?? [], newComponent.slots ?? [], changes);
  }

  // Deterministic ordering: severity, then component, then kind, then target.
  changes.sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    if (a.component !== b.component) return a.component.localeCompare(b.component);
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return (a.target ?? "").localeCompare(b.target ?? "");
  });

  const summary: DiffSummary = {
    breaking: changes.filter((c) => c.severity === "breaking").length,
    additive: changes.filter((c) => c.severity === "additive").length,
    docOnly: changes.filter((c) => c.severity === "doc-only").length,
    total: changes.length,
  };

  return { changes, summary, hasBreaking: summary.breaking > 0 };
}

const SEVERITY_LABELS: Record<DiffSeverity, string> = {
  breaking: "BREAKING",
  additive: "ADDITIVE",
  "doc-only": "DOC-ONLY",
};

/**
 * Render a {@link DiffResult} as a human-readable, grouped report.
 *
 * @example
 * ```ts
 * console.log(formatDiffReport(diffComponentApi(oldApi, newApi)));
 * ```
 */
export function formatDiffReport(result: DiffResult): string {
  const lines: string[] = [];

  if (result.changes.length === 0) {
    return "No API changes detected.";
  }

  for (const severity of ["breaking", "additive", "doc-only"] as const) {
    const group = result.changes.filter((c) => c.severity === severity);
    if (group.length === 0) continue;

    lines.push(`${SEVERITY_LABELS[severity]} (${group.length})`);
    for (const change of group) {
      let line = `  • [${change.component}] ${change.message}`;
      if (change.from != null && change.to != null) {
        line += `: ${change.from} → ${change.to}`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  lines.push(
    `Summary: ${result.summary.breaking} breaking, ${result.summary.additive} additive, ${result.summary.docOnly} doc-only.`,
  );

  return lines.join("\n");
}
