import { join, resolve } from "node:path";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";
import {
  renderComponentIndexToMarkdown,
  renderComponentsToMarkdown,
  renderComponentToMarkdown,
} from "./markdown-render-utils";
import Writer from "./Writer";
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";

export interface WriteMarkdownOptions {
  write?: boolean;
  outFile: string;
  /**
   * Emit one `<ModuleName>.md` file per component into this directory,
   * plus an index `README.md` linking to each, instead of the single
   * combined `outFile`. See `jsonOptions.outDir` for the equivalent JSON
   * option.
   */
  outDir?: string;
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

function newDocument(options: Pick<WriteMarkdownOptions, "onAppend">, components: ComponentDocs): WriterMarkdown {
  return new WriterMarkdown({
    onAppend: (type, document) => {
      options.onAppend?.call(null, type, document, components);
    },
  });
}

/**
 * Writes one `<ModuleName>.md` file per component into `outDir`, plus an
 * index `README.md` linking to each. Mirrors `writer-json.ts`'s `outDir`
 * mode; unlike JSON, `moduleName` collisions aren't handled here since the
 * built-in Markdown writer only ever receives the "exported" component set,
 * where `moduleName` is unique by construction.
 */
async function writeMarkdownComponents(components: ComponentDocs, options: WriteMarkdownOptions) {
  const outDir = options.outDir as string;
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const writer = new Writer({ dryRun: options.dryRun });

  const indexDocument = newDocument(options, components);
  renderComponentIndexToMarkdown(indexDocument, document.components, options.entryExports);
  const indexFile = resolve(join(outDir, "README.md"));
  const wroteIndex = await writer.write(indexFile, indexDocument.end());
  if (!options.dryRun) info(`${wroteIndex ? "created" : "unchanged"} "${indexFile}".`);

  await Promise.all(
    document.components.map(async (component) => {
      const componentDocument = newDocument(options, components);
      renderComponentToMarkdown(componentDocument, component);
      const outFile = resolve(join(outDir, `${component.moduleName}.md`));
      const wasWritten = await writer.write(outFile, componentDocument.end());
      if (!options.dryRun) info(`${wasWritten ? "created" : "unchanged"} "${outFile}".`);
    }),
  );
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
  const document = newDocument(options, components);

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
  if (options.outDir) {
    if (options.write !== false) await writeMarkdownComponents(components, options);
    return undefined;
  }

  const write = options?.write !== false;
  const rendered = renderMarkdownDocument(components, options);

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    const wasWritten = await new Writer({ dryRun: options.dryRun }).write(outFile, rendered);
    if (!options.dryRun) info(`${wasWritten ? "created" : "unchanged"} "${options.outFile}".`);
  }

  return rendered;
}
