import type { ComponentDocs } from "../plugin";

/**
 * Which component set a writer expects.
 *
 * `"exported"` gets `result.components`: only components reachable from the
 * entry barrel, keyed by `moduleName`, which is unique there by construction
 * (JS export names can't collide).
 *
 * `"all"` gets `result.allComponentsForTypes`: every `.svelte` file `--glob`
 * discovered, keyed by resolved `filePath`, not `moduleName` — two files in
 * different directories can share a basename (e.g. `Menu/Menu.svelte` and
 * `icons/Menu.svelte`), so `moduleName` is not unique in this set. A writer
 * that derives an output location (a file name, a map key) from `moduleName`
 * alone will silently drop one of the colliding components; key on `filePath`
 * instead, or on `moduleName` only after checking for a collision (see
 * `writer-json.ts`'s `outDir` mode for that pattern).
 */
type WriterComponentSet = "exported" | "all";

/**
 * A pluggable output format. Built-in writers (`json`, `markdown`, `types`)
 * register themselves under these names; third parties can `registerWriter`
 * their own to add new output formats without a core PR.
 */
export interface OutputWriter<TOptions = unknown> {
  name: string;
  /** Which component set this writer expects — see {@link WriterComponentSet}. @default "exported" */
  componentSet?: WriterComponentSet;
  /**
   * `options` always carries `dryRun: true` under `sveld --dry-run` (or
   * `{ dryRun: true }` from the programmatic API), alongside whatever
   * `TOptions` fields the writer defines. `write` must check it and skip
   * touching disk; sveld does not do this for you. A thrown error (sync or
   * async) is re-thrown by the caller as `sveld: writer "<name>" failed: ...`
   * with the original error as `cause`.
   */
  write(components: ComponentDocs, options: TOptions): Promise<unknown> | unknown;
}

export interface RegisterWriterOptions {
  /** Overwrite an existing writer registered under the same `name` instead of throwing. @default false */
  replace?: boolean;
}

const writers = new Map<string, OutputWriter<unknown>>();

/**
 * Registers a writer under `writer.name`. Throws if that name is already
 * taken - a silent overwrite would otherwise let a userland writer clobber
 * a built-in one (`json`/`markdown`/`types`/`custom-elements`/`llms`), or
 * two third-party writers with the same name shadow each other depending on
 * import order. Pass `{ replace: true }` to overwrite intentionally, e.g.
 * when hot-reloading a writer module during development.
 */
export function registerWriter<TOptions = unknown>(
  writer: OutputWriter<TOptions>,
  options?: RegisterWriterOptions,
): void {
  if (!options?.replace && writers.has(writer.name)) {
    throw new Error(
      `sveld: a writer named "${writer.name}" is already registered. Pass { replace: true } to overwrite it.`,
    );
  }
  writers.set(writer.name, writer as OutputWriter<unknown>);
}

export function getWriter(name: string): OutputWriter<unknown> | undefined {
  return writers.get(name);
}

export function listWriters(): OutputWriter<unknown>[] {
  return Array.from(writers.values());
}
