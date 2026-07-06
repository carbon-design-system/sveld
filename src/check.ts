import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ComponentDocApi, ComponentDocs } from "./bundle";
import type { SveldRuntimeOptions } from "./load-config";
import type { EntryExports } from "./parse-entry-exports";
import {
  buildComponentApiDocument,
  COMPONENT_API_SCHEMA_VERSION,
  type ComponentApiDocument,
} from "./writer/document-model";

type Prop = ComponentDocApi["props"][number];
type Event = ComponentDocApi["events"][number];
type Slot = ComponentDocApi["slots"][number];

export type SemverBump = "major" | "minor" | "patch" | "none";

/** One API diff between the committed snapshot and the current parse. */
export interface ApiChange {
  /** Component `moduleName` this change belongs to, or `"*"` for document-wide notices. */
  component: string;
  kind: "component" | "prop" | "moduleExport" | "event" | "slot" | "shape";
  /** Prop, event, slot, or shape-field name, when applicable. */
  name?: string;
  bump: SemverBump;
  message: string;
}

export interface CheckResult {
  /** `false` when there was nothing on disk to diff against (e.g. first run). */
  snapshotExists: boolean;
  snapshotFile: string;
  changes: ApiChange[];
  /** Highest bump across all changes. */
  bump: SemverBump;
}

const BUMP_RANK: Record<SemverBump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

function maxBump(a: SemverBump, b: SemverBump): SemverBump {
  return BUMP_RANK[b] > BUMP_RANK[a] ? b : a;
}

function highestBump(changes: ApiChange[]): SemverBump {
  return changes.reduce<SemverBump>((bump, change) => maxBump(bump, change.bump), "none");
}

/**
 * Splits a type string on top-level `|`, ignoring `|` nested inside
 * `<>`/`()`/`{}`/`[]` or string literals (e.g. a `"a|b"` literal member).
 */
function splitUnionMembers(type: string): Set<string> {
  const members: string[] = [];
  let depth = 0;
  let current = "";
  let quote: string | null = null;

  for (let i = 0; i < type.length; i++) {
    const ch = type[i];

    if (quote) {
      current += ch;
      if (ch === "\\") {
        i++;
        current += type[i] ?? "";
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

    if (ch === "<" || ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ">" || ch === ")" || ch === "}" || ch === "]") depth--;

    if (ch === "|" && depth === 0) {
      members.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }
  members.push(current.trim());

  return new Set(members.filter((member) => member.length > 0));
}

/**
 * Classifies a type-string change as additive (widened union), breaking
 * (narrowed union), or unchanged. Only top-level union members count.
 * Other structural changes (generics, object shape, function signature) are
 * breaking, same as cargo-semver-checks' "when in doubt, call it major".
 */
function classifyTypeChange(oldType: string | undefined, newType: string | undefined): SemverBump {
  if (oldType === newType) return "none";
  if (oldType === undefined || newType === undefined) return "major";

  const oldMembers = splitUnionMembers(oldType);
  const newMembers = splitUnionMembers(newType);
  const gainedMembers = [...newMembers].some((member) => !oldMembers.has(member));
  const lostMembers = [...oldMembers].some((member) => !newMembers.has(member));

  if (!gainedMembers && !lostMembers) return "none"; // same members, reordered
  if (gainedMembers && !lostMembers) return "minor";
  if (lostMembers && !gainedMembers) return "major";
  return "major"; // both gained and lost members
}

function diffPropList(
  component: string,
  kind: "prop" | "moduleExport",
  oldProps: Prop[],
  newProps: Prop[],
): ApiChange[] {
  const label = kind === "prop" ? "prop" : "export";
  const changes: ApiChange[] = [];
  const oldByName = new Map(oldProps.map((prop) => [prop.name, prop]));
  const newByName = new Map(newProps.map((prop) => [prop.name, prop]));

  for (const [name, prop] of newByName) {
    if (oldByName.has(name)) continue;
    changes.push({
      component,
      kind,
      name,
      bump: prop.isRequired ? "major" : "minor",
      message: `${label} "${name}" added${prop.isRequired ? " (required)" : ""}`,
    });
  }

  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    changes.push({ component, kind, name, bump: "major", message: `${label} "${name}" removed` });
  }

  for (const [name, oldProp] of oldByName) {
    const newProp = newByName.get(name);
    if (!newProp) continue;

    if (oldProp.isRequired !== newProp.isRequired) {
      changes.push({
        component,
        kind,
        name,
        bump: newProp.isRequired ? "major" : "minor",
        message: `${label} "${name}" became ${newProp.isRequired ? "required" : "optional"}`,
      });
    }

    const typeBump = classifyTypeChange(oldProp.type, newProp.type);
    if (typeBump !== "none") {
      changes.push({
        component,
        kind,
        name,
        bump: typeBump,
        message: `${label} "${name}" type changed from \`${oldProp.type ?? "unknown"}\` to \`${newProp.type ?? "unknown"}\``,
      });
    }
  }

  return changes;
}

function diffEvents(component: string, oldEvents: Event[], newEvents: Event[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const oldByName = new Map(oldEvents.map((event) => [event.name, event]));
  const newByName = new Map(newEvents.map((event) => [event.name, event]));

  for (const [name] of newByName) {
    if (oldByName.has(name)) continue;
    changes.push({ component, kind: "event", name, bump: "minor", message: `event "${name}" added` });
  }

  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    changes.push({ component, kind: "event", name, bump: "major", message: `event "${name}" removed` });
  }

  for (const [name, oldEvent] of oldByName) {
    const newEvent = newByName.get(name);
    if (!newEvent) continue;

    if (oldEvent.type !== newEvent.type) {
      changes.push({
        component,
        kind: "event",
        name,
        bump: "major",
        message: `event "${name}" changed from ${oldEvent.type} to ${newEvent.type}`,
      });
      continue;
    }

    const oldDetail = oldEvent.type === "dispatched" ? oldEvent.detail : undefined;
    const newDetail = newEvent.type === "dispatched" ? newEvent.detail : undefined;
    const detailBump = classifyTypeChange(oldDetail, newDetail);
    if (detailBump !== "none") {
      changes.push({
        component,
        kind: "event",
        name,
        bump: detailBump,
        message: `event "${name}" detail changed from \`${oldDetail ?? "unknown"}\` to \`${newDetail ?? "unknown"}\``,
      });
    }
  }

  return changes;
}

function slotKey(slot: Slot): string {
  return slot.name ?? "default";
}

function diffSlots(component: string, oldSlots: Slot[], newSlots: Slot[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const oldByName = new Map(oldSlots.map((slot) => [slotKey(slot), slot]));
  const newByName = new Map(newSlots.map((slot) => [slotKey(slot), slot]));

  for (const [name] of newByName) {
    if (oldByName.has(name)) continue;
    changes.push({ component, kind: "slot", name, bump: "minor", message: `slot "${name}" added` });
  }

  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    changes.push({ component, kind: "slot", name, bump: "major", message: `slot "${name}" removed` });
  }

  for (const [name, oldSlot] of oldByName) {
    const newSlot = newByName.get(name);
    if (!newSlot) continue;

    const bump = classifyTypeChange(oldSlot.slot_props, newSlot.slot_props);
    if (bump !== "none") {
      changes.push({
        component,
        kind: "slot",
        name,
        bump,
        message: `slot "${name}" props changed from \`${oldSlot.slot_props ?? "none"}\` to \`${newSlot.slot_props ?? "none"}\``,
      });
    }
  }

  return changes;
}

/** JSDoc-only fields ignored when diffing types. */
const NON_SEMANTIC_KEYS = new Set(["description", "source", "componentCommentSource", "tags"]);

function stripNonSemanticFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNonSemanticFields);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (NON_SEMANTIC_KEYS.has(key)) continue;
      result[key] = stripNonSemanticFields(val);
    }
    return result;
  }
  return value;
}

/** Fields not covered by `diffPropList`/`diffEvents`/`diffSlots`. Any change is breaking. */
const SHAPE_FIELDS = ["generics", "rest_props", "extends", "contexts", "typedefs"] as const;

function diffShape(component: string, oldComponent: ComponentDocApi, newComponent: ComponentDocApi): ApiChange[] {
  const changes: ApiChange[] = [];

  for (const field of SHAPE_FIELDS) {
    const oldJson = JSON.stringify(stripNonSemanticFields(oldComponent[field]));
    const newJson = JSON.stringify(stripNonSemanticFields(newComponent[field]));
    if (oldJson !== newJson) {
      changes.push({
        component,
        kind: "shape",
        name: field,
        bump: "major",
        message: `"${field}" changed (breaking)`,
      });
    }
  }

  return changes;
}

function diffComponent(oldComponent: ComponentDocApi, newComponent: ComponentDocApi): ApiChange[] {
  const name = newComponent.moduleName;
  return [
    ...diffPropList(name, "prop", oldComponent.props, newComponent.props),
    ...diffPropList(name, "moduleExport", oldComponent.moduleExports, newComponent.moduleExports),
    ...diffEvents(name, oldComponent.events, newComponent.events),
    ...diffSlots(name, oldComponent.slots, newComponent.slots),
    ...diffShape(name, oldComponent, newComponent),
  ];
}

/** Diffs two `COMPONENT_API.json` documents and assigns a semver bump to each change. */
export function diffApiDocuments(previous: ComponentApiDocument, next: ComponentApiDocument): ApiChange[] {
  const changes: ApiChange[] = [];
  const oldByName = new Map(previous.components.map((component) => [component.moduleName, component]));
  const newByName = new Map(next.components.map((component) => [component.moduleName, component]));

  for (const [name] of newByName) {
    if (oldByName.has(name)) continue;
    changes.push({ component: name, kind: "component", bump: "minor", message: `component "${name}" added` });
  }

  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    changes.push({ component: name, kind: "component", bump: "major", message: `component "${name}" removed` });
  }

  for (const [name, oldComponent] of oldByName) {
    const newComponent = newByName.get(name);
    if (!newComponent) continue;
    changes.push(...diffComponent(oldComponent, newComponent));
  }

  return changes;
}

async function readSnapshot(snapshotFile: string): Promise<ComponentApiDocument | null> {
  let raw: string;
  try {
    raw = await readFile(path.resolve(snapshotFile), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  try {
    return JSON.parse(raw) as ComponentApiDocument;
  } catch {
    throw new Error(`sveld: could not parse "${snapshotFile}" as JSON. Is it a sveld COMPONENT_API.json snapshot?`);
  }
}

export interface RunCheckOptions {
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
}

/**
 * Resolves the snapshot path for `check`: an explicit string wins, otherwise
 * it falls back to the `json` writer's `outFile`, or `COMPONENT_API.json`.
 */
export function resolveCheckSnapshotFile(options: Pick<SveldRuntimeOptions, "check" | "jsonOptions">): string {
  if (typeof options.check === "string") return options.check;
  return options.jsonOptions?.outFile ?? "COMPONENT_API.json";
}

/**
 * Diffs the current component set against a committed `COMPONENT_API.json`
 * snapshot and assigns a semver bump to each change. Returns
 * `snapshotExists: false` when no snapshot file exists yet, so the first
 * run does not fail CI.
 */
export async function runCheck(
  components: ComponentDocs,
  snapshotFile: string,
  options: RunCheckOptions = {},
): Promise<CheckResult> {
  const previous = await readSnapshot(snapshotFile);
  if (previous === null) {
    return { snapshotExists: false, snapshotFile, changes: [], bump: "none" };
  }

  if (previous.schemaVersion !== COMPONENT_API_SCHEMA_VERSION) {
    return {
      snapshotExists: true,
      snapshotFile,
      changes: [
        {
          component: "*",
          kind: "shape",
          bump: "none",
          message: `snapshot schemaVersion ${previous.schemaVersion} does not match the current schemaVersion ${COMPONENT_API_SCHEMA_VERSION}; skipping diff`,
        },
      ],
      bump: "none",
    };
  }

  const next = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const changes = diffApiDocuments(previous, next);

  return { snapshotExists: true, snapshotFile, changes, bump: highestBump(changes) };
}

const BUMP_LABELS: Record<SemverBump, string> = {
  major: "BREAKING",
  minor: "additive",
  patch: "patch",
  none: "no change",
};

/** Groups changes by component for CLI output. */
export function formatCheckReport(result: CheckResult): string {
  if (!result.snapshotExists) {
    return `sveld --check: no snapshot found at "${result.snapshotFile}". Run \`sveld --json\` and commit the output first.`;
  }

  if (result.changes.length === 0) {
    return `sveld --check: no API changes detected against "${result.snapshotFile}".`;
  }

  const lines: string[] = [];
  const total = result.changes.length;
  lines.push(`sveld --check: ${total} API change${total === 1 ? "" : "s"} detected against "${result.snapshotFile}".`);
  lines.push(`Suggested semver bump: ${result.bump}.`);

  const byComponent = new Map<string, ApiChange[]>();
  for (const change of result.changes) {
    const group = byComponent.get(change.component) ?? [];
    group.push(change);
    byComponent.set(change.component, group);
  }

  for (const [component, changes] of byComponent) {
    lines.push("");
    lines.push(`  ${component}`);
    for (const change of changes) {
      lines.push(`    [${BUMP_LABELS[change.bump]}] ${change.message}`);
    }
  }

  return lines.join("\n");
}
