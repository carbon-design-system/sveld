/**
 * `sveld/testing` — golden-file helper for guarding a Svelte library's
 * generated component API against unintended drift.
 *
 * A downstream library commits a golden snapshot of its component API and, in a
 * test, calls {@link assertComponentApi}. The helper regenerates the API
 * in-memory, diffs it against the committed snapshot, and throws a readable,
 * classified error (breaking / additive / doc-only) on any drift. It depends on
 * no test framework, so it works from Bun, Jest, Vitest, or a plain script.
 *
 * @example
 * ```ts
 * import { test } from "vitest";
 * import { assertComponentApi } from "sveld/testing";
 *
 * test("component API is stable", async () => {
 *   await assertComponentApi({
 *     input: "src/index.js",
 *     snapshot: "test/__snapshots__/component-api.json",
 *   });
 * });
 * ```
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ParsedComponent } from "./ComponentParser";
import {
  type ApiDiff,
  type ComponentApi,
  type ComponentApiComponent,
  type ComponentApiEvent,
  type ComponentApiProp,
  type ComponentApiSlot,
  type ComponentApiTypedef,
  diffComponentApi,
  formatApiDiff,
  SNAPSHOT_VERSION,
} from "./diff";
import { type ComponentDocs, generateBundle } from "./plugin";

export {
  type ApiChange,
  type ApiDiff,
  type ChangeCategory,
  type ChangeKind,
  type ComponentApi,
  diffComponentApi,
  formatApiDiff,
  SNAPSHOT_VERSION,
} from "./diff";

type SourceProp = ParsedComponent["props"][number];
type SourceSlot = ParsedComponent["slots"][number];
type SourceEvent = ParsedComponent["events"][number];
type SourceTypedef = ParsedComponent["typedefs"][number];

/** Options shared by API generation and assertion. */
export interface GenerateComponentApiOptions {
  /**
   * Entry point to the uncompiled Svelte source: either a file (e.g. the
   * library's `index.js` with re-exports) or a directory. If omitted, the
   * `svelte` field of the nearest `package.json` is used.
   */
  input?: string;
  /**
   * Glob the input directory for all `.svelte` files. Defaults to `true` when
   * `input` resolves to a directory, `false` otherwise.
   */
  glob?: boolean;
}

function normalizeProp(prop: SourceProp): ComponentApiProp {
  return {
    type: prop.type,
    kind: prop.kind,
    constant: prop.constant,
    isRequired: prop.isRequired,
    isFunction: prop.isFunction,
    reactive: prop.reactive,
    bindable: prop.bindable,
    binding: prop.binding,
    value: prop.value,
    returnType: prop.returnType,
    params: prop.params?.map((param) => ({
      name: param.name,
      type: param.type,
      optional: param.optional,
      description: param.description,
    })),
    description: prop.description,
  };
}

function normalizeSlot(slot: SourceSlot): ComponentApiSlot {
  return {
    default: slot.default,
    slot_props: slot.slot_props,
    fallback: slot.fallback,
    description: slot.description,
  };
}

function normalizeEvent(event: SourceEvent): ComponentApiEvent {
  return {
    type: event.type,
    detail: event.detail,
    description: event.description,
  };
}

function normalizeTypedef(typedef: SourceTypedef): ComponentApiTypedef {
  return { ts: typedef.ts, type: typedef.type, description: typedef.description };
}

/** Builds a record keyed by `name`, inserting keys in sorted order for determinism. */
function toRecord<T, U>(items: T[], name: (item: T) => string, map: (item: T) => U): Record<string, U> {
  const entries = items.map((item) => [name(item), map(item)] as const).sort(([a], [b]) => a.localeCompare(b));
  const record: Record<string, U> = {};
  for (const [key, value] of entries) record[key] = value;
  return record;
}

function normalizeComponent(component: ParsedComponent): ComponentApiComponent {
  return {
    props: toRecord(component.props, (prop) => prop.name, normalizeProp),
    moduleExports: toRecord(component.moduleExports, (prop) => prop.name, normalizeProp),
    slots: toRecord(
      component.slots,
      (slot) => (slot.default || slot.name == null ? "default" : slot.name),
      normalizeSlot,
    ),
    events: toRecord(component.events, (event) => event.name, normalizeEvent),
    typedefs: toRecord(component.typedefs, (typedef) => typedef.name, normalizeTypedef),
    rest_props: component.rest_props !== undefined,
    generics: component.generics,
    description: component.componentComment,
  };
}

/**
 * Projects the parsed component bundle into the deterministic, position-free
 * {@link ComponentApi} snapshot shape.
 */
function toComponentApi(components: ComponentDocs): ComponentApi {
  const entries = Array.from(components.values()).sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  const normalized: Record<string, ComponentApiComponent> = {};
  for (const component of entries) {
    normalized[component.moduleName] = normalizeComponent(component);
  }
  return { version: SNAPSHOT_VERSION, components: normalized };
}

/**
 * Generates the component API for a Svelte library in-memory, returning a
 * deterministic snapshot that is safe to commit as a golden file.
 *
 * @example
 * ```ts
 * const api = await generateComponentApi({ input: "src/index.js" });
 * console.log(Object.keys(api.components)); // ["Button", "Modal", ...]
 * ```
 */
export async function generateComponentApi(options?: GenerateComponentApiOptions): Promise<ComponentApi> {
  const input = options?.input ? resolve(options.input) : resolveDefaultEntry();
  if (input === null) {
    throw new Error(
      "sveld/testing: could not determine an entry point. Pass `input` or set the `svelte` field in package.json.",
    );
  }

  const glob = options?.glob ?? isDirectory(input);
  const { components } = await generateBundle(input, glob);
  return toComponentApi(components);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function resolveDefaultEntry(): string | null {
  const pkgPath = resolve(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { svelte?: string };
    if (typeof pkg.svelte === "string" && pkg.svelte.trim()) return resolve(process.cwd(), pkg.svelte);
  } catch {
    return null;
  }
  return null;
}

/** Serializes a snapshot to stable, pretty-printed JSON with a trailing newline. */
export function serializeComponentApi(api: ComponentApi): string {
  return `${JSON.stringify(api, null, 2)}\n`;
}

/** Writes a snapshot to `snapshotPath`, creating parent directories as needed. */
export function writeComponentApiSnapshot(snapshotPath: string, api: ComponentApi): void {
  const target = resolve(snapshotPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, serializeComponentApi(api));
}

/** Error thrown by {@link assertComponentApi} when the generated API drifts from the golden snapshot. */
export class ComponentApiDriftError extends Error {
  /** The structured, classified diff between the golden snapshot and the current API. */
  readonly diff: ApiDiff;

  constructor(diff: ApiDiff) {
    super(formatApiDiff(diff));
    this.name = "ComponentApiDriftError";
    this.diff = diff;
  }
}

/** Options for {@link assertComponentApi}. */
export interface AssertComponentApiOptions extends GenerateComponentApiOptions {
  /** Path to the committed golden snapshot JSON file. */
  snapshot: string;
  /**
   * When `true`, (re)write the golden snapshot from the current API instead of
   * asserting against it. Also enabled when the `SVELD_UPDATE_SNAPSHOT`
   * environment variable is set to a truthy value (e.g. `1` or `true`).
   */
  update?: boolean;
}

function shouldUpdate(option?: boolean): boolean {
  if (option !== undefined) return option;
  const flag = process.env.SVELD_UPDATE_SNAPSHOT;
  return flag === "1" || flag === "true";
}

/**
 * Asserts that the library's current component API matches the committed golden
 * snapshot, throwing a {@link ComponentApiDriftError} with a readable,
 * classified diff on any drift.
 *
 * Run with `update: true` (or `SVELD_UPDATE_SNAPSHOT=1`) to create or refresh
 * the snapshot. The first run for a new snapshot path requires update mode.
 *
 * @throws {ComponentApiDriftError} when the API drifts from the snapshot.
 * @throws {Error} when the snapshot file is missing and update mode is off.
 *
 * @example
 * ```ts
 * await assertComponentApi({
 *   input: "src/index.js",
 *   snapshot: "test/__snapshots__/component-api.json",
 * });
 * ```
 */
export async function assertComponentApi(options: AssertComponentApiOptions): Promise<ApiDiff> {
  const current = await generateComponentApi(options);
  const snapshotPath = resolve(options.snapshot);

  if (shouldUpdate(options.update)) {
    writeComponentApiSnapshot(snapshotPath, current);
    return { changes: [], breaking: [], additive: [], docOnly: [], matches: true, classification: null };
  }

  if (!existsSync(snapshotPath)) {
    throw new Error(
      `sveld/testing: golden snapshot not found at "${snapshotPath}". ` +
        "Create it by running this assertion once with `update: true` (or SVELD_UPDATE_SNAPSHOT=1).",
    );
  }

  let golden: ComponentApi;
  try {
    golden = JSON.parse(readFileSync(snapshotPath, "utf-8")) as ComponentApi;
  } catch (error) {
    throw new Error(`sveld/testing: failed to parse golden snapshot at "${snapshotPath}": ${(error as Error).message}`);
  }

  const diff = diffComponentApi(golden, current);
  if (!diff.matches) throw new ComponentApiDriftError(diff);
  return diff;
}
