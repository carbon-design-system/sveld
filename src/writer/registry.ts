import type { ComponentDocs } from "../plugin";

/** Which component set a writer expects: exported-only, or every discovered component. */
export type WriterComponentSet = "exported" | "all";

/**
 * A pluggable output format. Built-in writers (`json`, `markdown`, `types`)
 * register themselves under these names; third parties can `registerWriter`
 * their own to add new output formats without a core PR.
 */
export interface OutputWriter<TOptions = unknown> {
  name: string;
  /** Which component set this writer expects. @default "exported" */
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
