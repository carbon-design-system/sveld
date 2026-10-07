import { join, resolve } from "node:path";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";
import type { AppendType, MarkdownDocument } from "./markdown-document";
import {
  renderComponentIndexToMarkdown,
  renderComponentsToMarkdown,
  renderComponentToMarkdown,
} from "./markdown-render-utils";
import Writer from "./Writer";
import { createMarkdownDocument } from "./writer-markdown-core";

/** User-settable `markdownOptions`. */
export interface MarkdownOptions {
  /**
   * Path (relative to the project root) for the single combined Markdown
   * document. Ignored when `outDir` is set.
   * @default "COMPONENT_INDEX.md"
   */
  outFile?: string;
  /**
   * Emit one `<ModuleName>.md` file per component into this directory,
   * plus an index `README.md` linking to each, instead of the single
   * combined `outFile`. See `jsonOptions.outDir` for the equivalent JSON
   * option.
   */
  outDir?: string;
  /**
   * Called every time a heading, quote, paragraph, divider, or raw block is
   * appended to the document, to inject extra content.
   */
  onAppend?: (type: AppendType, document: MarkdownDocument, components: ComponentDocs) => void;
}

/** `MarkdownOptions` plus the fields the caller (`plugin.ts`) always injects. */
export interface WriteMarkdownOptions extends MarkdownOptions {
  outFile: string;
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
}

/**
 * Unlike the JSON writer, `moduleName` collisions aren't handled: this only
 * receives the exported component set, where `moduleName` is unique.
 */
async function writeMarkdownComponents(components: ComponentDocs, options: WriteMarkdownOptions, outDir: string) {
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const writer = new Writer();

  const indexDocument = createMarkdownDocument(components, options);
  renderComponentIndexToMarkdown(indexDocument, document.components, options.entryExports);
  const indexFile = resolve(join(outDir, "README.md"));
  const wroteIndex = await writer.write(indexFile, indexDocument.end());
  info(`${wroteIndex ? "created" : "unchanged"} "${indexFile}".`);

  await Promise.all(
    document.components.map(async (component) => {
      const componentDocument = createMarkdownDocument(components, options);
      renderComponentToMarkdown(componentDocument, component);
      const outFile = resolve(join(outDir, `${component.moduleName}.md`));
      const wasWritten = await writer.write(outFile, componentDocument.end());
      info(`${wasWritten ? "created" : "unchanged"} "${outFile}".`);
    }),
  );
}

/** Shared by `writeMarkdown` and the CLI's `--stdout` mode so the two can't drift. */
export function renderMarkdownDocument(
  components: ComponentDocs,
  options: Pick<WriteMarkdownOptions, "entryExports" | "onAppend">,
): string {
  const document = createMarkdownDocument(components, options);
  renderComponentsToMarkdown(document, components, options.entryExports);
  return document.end();
}

export default async function writeMarkdown(components: ComponentDocs, options: WriteMarkdownOptions) {
  if (options.outDir) {
    await writeMarkdownComponents(components, options, options.outDir);
    return;
  }

  const outFile = resolve(options.outFile);
  const wasWritten = await new Writer().write(outFile, renderMarkdownDocument(components, options));
  info(`${wasWritten ? "created" : "unchanged"} "${options.outFile}".`);
}
