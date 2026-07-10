import { join } from "node:path";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocs } from "../plugin";
import { renderComponentsToMarkdown } from "./markdown-render-utils";
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";

export interface WriteMarkdownOptions {
  write?: boolean;
  outFile: string;
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
  onAppend?: (type: AppendType, document: WriterMarkdown, components: ComponentDocs) => void;
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
  const document = new WriterMarkdown({
    onAppend: (type, document) => {
      options.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components, options.entryExports);

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    await document.write(outFile, document.end());
    info(`created "${options.outFile}".`);
  }

  return document.end();
}
