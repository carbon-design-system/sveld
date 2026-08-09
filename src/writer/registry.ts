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
  write(components: ComponentDocs, options: TOptions): Promise<unknown> | unknown;
}

const writers = new Map<string, OutputWriter<unknown>>();

export function registerWriter<TOptions = unknown>(writer: OutputWriter<TOptions>): void {
  writers.set(writer.name, writer as OutputWriter<unknown>);
}

export function getWriter(name: string): OutputWriter<unknown> | undefined {
  return writers.get(name);
}

export function listWriters(): OutputWriter<unknown>[] {
  return Array.from(writers.values());
}
