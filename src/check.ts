import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ComponentDocApi, ComponentDocs } from "./bundle";
import type { SveldRuntimeOptions } from "./load-config";
import type { EntryExports } from "./parse-entry-exports";
import { formatJsonOutput } from "./path";
import { indexOfTopLevelArrow, splitTopLevel } from "./type-text";
import {
  buildComponentApiDocument,
  COMPONENT_API_SCHEMA_VERSION,
  type ComponentApiDocument,
} from "./writer/document-model";

const PARAM_NAME_SPLIT_REGEX = /[:=]/;

type Prop = ComponentDocApi["props"][number];
type Event = ComponentDocApi["events"][number];
type Slot = ComponentDocApi["slots"][number];

export type SemverBump = "major" | "minor" | "patch" | "none";

/** Minimum bump `--check-level` fails the run on. */
export type CheckLevel = "major" | "minor" | "patch";

/** One API diff between the committed snapshot and the current parse. */
export interface ApiChange {
  /** Component `moduleName` this change belongs to, or `"*"` for document-wide notices. */
  component: string;
  kind: "component" | "prop" | "moduleExport" | "event" | "slot" | "shape" | "schema";
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

const DEFAULT_SNAPSHOT_FILE = "COMPONENT_API.json";

const BUMP_RANK: Record<SemverBump, number> = { none: 0, patch: 1, minor: 2, major: 3 };

function maxBump(a: SemverBump, b: SemverBump): SemverBump {
  return BUMP_RANK[b] > BUMP_RANK[a] ? b : a;
}

function highestBump(changes: ApiChange[]): SemverBump {
  return changes.reduce<SemverBump>((bump, change) => maxBump(bump, change.bump), "none");
}

/** True when `bump` is at or above `level` on the `none < patch < minor < major` scale. */
export function bumpMeetsLevel(bump: SemverBump, level: CheckLevel): boolean {
  return BUMP_RANK[bump] >= BUMP_RANK[level];
}

function splitUnionMembers(type: string): Set<string> {
  return new Set(
    splitTopLevel(type, "|")
      .map((member) => member.trim())
      .filter((member) => member.length > 0),
  );
}

interface ParsedFunctionType {
  params: string[];
  returnType: string;
}

/** Textually splits `(a: string) => void` into params and return type; `undefined` if not shaped like one. */
function parseFunctionType(type: string): ParsedFunctionType | undefined {
  const arrowIndex = indexOfTopLevelArrow(type);
  if (arrowIndex === -1) return undefined;

  const paramsPart = type.slice(0, arrowIndex).trim();
  const returnType = type.slice(arrowIndex + 2).trim();
  if (!paramsPart.startsWith("(") || !paramsPart.endsWith(")")) return undefined;

  const inner = paramsPart.slice(1, -1).trim();
  const params = inner.length === 0 ? [] : splitTopLevel(inner, ",").map((param) => param.trim());

  return { params, returnType };
}

/** True for an optional param segment like `b?: number`. */
function isOptionalParam(param: string): boolean {
  const name = param.split(PARAM_NAME_SPLIT_REGEX, 1)[0] ?? "";
  return name.trimEnd().endsWith("?");
}

/** A changed return type or removed/reordered param is breaking; new trailing optional params are additive. */
function classifyFunctionTypeChange(oldFn: ParsedFunctionType, newFn: ParsedFunctionType): SemverBump {
  if (oldFn.returnType !== newFn.returnType) return "major";
  if (newFn.params.length < oldFn.params.length) return "major";

  for (let i = 0; i < oldFn.params.length; i++) {
    if (oldFn.params[i] !== newFn.params[i]) return "major";
  }

  if (newFn.params.length === oldFn.params.length) return "none";

  const addedParams = newFn.params.slice(oldFn.params.length);
  return addedParams.every(isOptionalParam) ? "minor" : "major";
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

  const oldFn = parseFunctionType(oldType);
  const newFn = parseFunctionType(newType);
  if (oldFn && newFn) return classifyFunctionTypeChange(oldFn, newFn);

  const oldMembers = splitUnionMembers(oldType);
  const newMembers = splitUnionMembers(newType);
  const gainedMembers = [...newMembers].some((member) => !oldMembers.has(member));
  const lostMembers = [...oldMembers].some((member) => !newMembers.has(member));

  if (!lostMembers) return gainedMembers ? "minor" : "none";
  return "major";
}

/** True when `bind:<name>` works: declared with runes `$bindable()` or legacy `@bindable writable`. */
function isWritableBinding(prop: Prop): boolean {
  return prop.bindable === true || prop.binding === "writable";
}

/** Items only in `newItems`, keys only in `oldItems`, and pairs present in both (in `oldItems` order). */
function matchByKey<T>(oldItems: T[], newItems: T[], key: (item: T) => string) {
  const oldByKey = new Map(oldItems.map((item) => [key(item), item]));
  const newByKey = new Map(newItems.map((item) => [key(item), item]));
  const added = [...newByKey].filter(([name]) => !oldByKey.has(name));
  const removed = [...oldByKey.keys()].filter((name) => !newByKey.has(name));
  const common: [name: string, oldItem: T, newItem: T][] = [];
  for (const [name, oldItem] of oldByKey) {
    const newItem = newByKey.get(name);
    if (newItem) common.push([name, oldItem, newItem]);
  }
  return { added, removed, common };
}

function diffPropList(
  component: string,
  kind: "prop" | "moduleExport",
  oldProps: Prop[],
  newProps: Prop[],
): ApiChange[] {
  const label = kind === "prop" ? "prop" : "export";
  const changes: ApiChange[] = [];
  const push = (name: string, bump: SemverBump, change: string) =>
    changes.push({ component, kind, name, bump, message: `${label} "${name}" ${change}` });
  const { added, removed, common } = matchByKey(oldProps, newProps, (prop) => prop.name);

  for (const [name, prop] of added) {
    push(name, prop.isRequired ? "major" : "minor", `added${prop.isRequired ? " (required)" : ""}`);
  }

  for (const name of removed) push(name, "major", "removed");

  for (const [name, oldProp, newProp] of common) {
    if (oldProp.isRequired !== newProp.isRequired) {
      push(name, newProp.isRequired ? "major" : "minor", `became ${newProp.isRequired ? "required" : "optional"}`);
    }

    const typeBump = classifyTypeChange(oldProp.type, newProp.type);
    if (typeBump !== "none") {
      push(name, typeBump, `type changed from \`${oldProp.type ?? "unknown"}\` to \`${newProp.type ?? "unknown"}\``);
    }

    const newWritable = isWritableBinding(newProp);
    if (isWritableBinding(oldProp) !== newWritable) {
      push(
        name,
        newWritable ? "minor" : "major",
        newWritable ? "gained a writable binding" : "lost its writable binding",
      );
    }

    if (oldProp.value !== newProp.value && typeBump === "none") {
      push(name, "patch", `default changed from \`${oldProp.value ?? "none"}\` to \`${newProp.value ?? "none"}\``);
    }

    const newDeprecated = newProp.deprecated !== undefined;
    if ((oldProp.deprecated !== undefined) !== newDeprecated) {
      push(name, newDeprecated ? "minor" : "patch", newDeprecated ? "marked as deprecated" : "no longer deprecated");
    }

    if (oldProp.constant !== newProp.constant) {
      push(name, "minor", newProp.constant ? "became constant" : "became mutable");
    }

    if (oldProp.reactive !== newProp.reactive) {
      push(name, "minor", newProp.reactive ? "became reactive" : "stopped being reactive");
    }
  }

  return changes;
}

function diffEvents(component: string, oldEvents: Event[], newEvents: Event[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const { added, removed, common } = matchByKey(oldEvents, newEvents, (event) => event.name);

  for (const [name] of added) {
    changes.push({ component, kind: "event", name, bump: "minor", message: `event "${name}" added` });
  }

  for (const name of removed) {
    changes.push({ component, kind: "event", name, bump: "major", message: `event "${name}" removed` });
  }

  for (const [name, oldEvent, newEvent] of common) {
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

function diffSlots(component: string, oldSlots: Slot[], newSlots: Slot[]): ApiChange[] {
  const changes: ApiChange[] = [];
  const { added, removed, common } = matchByKey(oldSlots, newSlots, (slot) => slot.name ?? "default");

  for (const [name] of added) {
    changes.push({ component, kind: "slot", name, bump: "minor", message: `slot "${name}" added` });
  }

  for (const name of removed) {
    changes.push({ component, kind: "slot", name, bump: "major", message: `slot "${name}" removed` });
  }

  for (const [name, oldSlot, newSlot] of common) {
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
  if (Array.isArray(value)) return value.map(stripNonSemanticFields);
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
      changes.push({ component, kind: "shape", name: field, bump: "major", message: `"${field}" changed (breaking)` });
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
  const { added, removed, common } = matchByKey(
    previous.components,
    next.components,
    (component) => component.moduleName,
  );

  for (const [name] of added) {
    changes.push({ component: name, kind: "component", bump: "minor", message: `component "${name}" added` });
  }

  for (const name of removed) {
    changes.push({ component: name, kind: "component", bump: "major", message: `component "${name}" removed` });
  }

  for (const [, oldComponent, newComponent] of common) {
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
  return options.jsonOptions?.outFile ?? DEFAULT_SNAPSHOT_FILE;
}

/**
 * Whether this run's `json` writer writes the `--check` snapshot itself, as
 * `sveld --json --check` does. Only then is a missing snapshot the first run
 * rather than a misconfigured path.
 */
export function writesCheckSnapshot(
  options: Pick<SveldRuntimeOptions, "json" | "jsonOptions" | "stdout">,
  snapshotFile: string,
): boolean {
  if (!options.json || options.stdout || options.jsonOptions?.outDir) return false;
  return path.resolve(options.jsonOptions?.outFile ?? DEFAULT_SNAPSHOT_FILE) === path.resolve(snapshotFile);
}

/**
 * Diffs the current component set against a committed `COMPONENT_API.json`
 * snapshot and assigns a semver bump to each change. Returns
 * `snapshotExists: false` when no snapshot file exists yet.
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
          kind: "schema",
          bump: "none",
          message: `snapshot schemaVersion ${previous.schemaVersion} differs from ${COMPONENT_API_SCHEMA_VERSION}; regenerate the snapshot`,
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
    const generate =
      result.snapshotFile === DEFAULT_SNAPSHOT_FILE
        ? "`sveld --json`"
        : `\`sveld --json\` with \`jsonOptions.outFile: "${result.snapshotFile}"\``;
    return `sveld --check: no snapshot found at "${result.snapshotFile}". Generate it with ${generate} and commit it.`;
  }

  if (result.changes.length === 0) {
    return `sveld --check: no API changes detected against "${result.snapshotFile}".`;
  }

  const total = result.changes.length;
  const lines = [
    `sveld --check: ${total} API change${total === 1 ? "" : "s"} detected against "${result.snapshotFile}".`,
    `Suggested semver bump: ${result.bump}.`,
  ];

  const byComponent = new Map<string, ApiChange[]>();
  for (const change of result.changes) {
    const group = byComponent.get(change.component) ?? [];
    group.push(change);
    byComponent.set(change.component, group);
  }

  for (const [component, changes] of byComponent) {
    lines.push("", `  ${component}`);
    for (const change of changes) {
      const label = change.kind === "schema" ? "schema" : BUMP_LABELS[change.bump];
      lines.push(`    [${label}] ${change.message}`);
    }
  }

  return lines.join("\n");
}

/** Envelope schema version for {@link CheckReportJson}. Bump when the shape of `CheckResult` changes incompatibly. */
export const CHECK_REPORT_SCHEMA_VERSION = 1;

/** `CheckResult`, serialized for stream consumers with a `kind` discriminator. */
export type CheckReportJson = CheckResult & { kind: "check-report"; schemaVersion: typeof CHECK_REPORT_SCHEMA_VERSION };

/** Serializes a `CheckResult` as JSON, for `--format=json --check`. */
export function formatCheckReportJson(result: CheckResult): string {
  const document: CheckReportJson = { kind: "check-report", schemaVersion: CHECK_REPORT_SCHEMA_VERSION, ...result };
  return formatJsonOutput(document);
}
