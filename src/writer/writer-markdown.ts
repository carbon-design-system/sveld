import { join } from "node:path";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocs } from "../plugin";
import { renderComponentsToMarkdown } from "./markdown-render-utils";
import Writer from "./Writer";
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";

export interface WriteMarkdownOptions {
  write?: boolean;
  outFile: string;
  /**
   * @internal Entry-barrel exports when `documentExports` is on. Always
   * computed from the parsed bundle and injected by the caller; setting it
   * via `markdownOptions` has no effect.
   */
  entryExports?: EntryExports;
  onAppend?: (type: AppendType, document: WriterMarkdown, components: ComponentDocs) => void;
  /** @internal Report the resolved path instead of writing. Always set by the caller from `sveld --dry-run`. */
  dryRun?: boolean;
}

/**
 * Renders the Markdown document without touching disk. Used by both
 * `writeMarkdown` and the CLI's `--stdout` mode so the two channels can't
 * drift.
 */
export function renderMarkdownDocument(
  components: ComponentDocs,
  options: Pick<WriteMarkdownOptions, "entryExports" | "onAppend">,
): string {
  const document = new WriterMarkdown({
    onAppend: (type, document) => {
      options.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components, options.entryExports);

  return document.end();
}

/**
 * @example
 * ```ts
 * const markdown = await writeMarkdown(components, {
 *   outFile: "COMPONENTS.md",
 *   write: true,
 *   onAppend: (type, doc) => {
 *     console.log(`Appended ${type}`);
 *   }
 * });
 * ```
 */
export default async function writeMarkdown(components: ComponentDocs, options: WriteMarkdownOptions) {
  const write = options?.write !== false;
  const rendered = renderMarkdownDocument(components, options);

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    await new Writer({ dryRun: options.dryRun }).write(outFile, rendered);
    if (!options.dryRun) info(`created "${options.outFile}".`);
  }

  return rendered;
}
