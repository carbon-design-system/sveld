import { join } from "node:path";
import type { ComponentDocs } from "../plugin";
import { type MarkdownRenderOptions, renderComponentFile, renderComponentsToMarkdown } from "./markdown-render-utils";
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";

/** Default directory for split markdown output, mirroring `jsonOptions.outDir`. */
export const DEFAULT_MARKDOWN_OUT_DIR = "docs";

export interface WriteMarkdownOptions extends MarkdownRenderOptions {
  write?: boolean;
  outFile: string;
  /** Write one markdown file per component instead of a single document. */
  split?: boolean;
  /** Directory for split output. Defaults to {@link DEFAULT_MARKDOWN_OUT_DIR}. */
  outDir?: string;
  onAppend?: (type: AppendType, document: WriterMarkdown, components: ComponentDocs) => void;
}

function pickRenderOptions(options: WriteMarkdownOptions): MarkdownRenderOptions {
  return { frontmatter: options.frontmatter, toc: options.toc, anchors: options.anchors };
}

/**
 * Write one markdown file per component into `outDir`.
 *
 * Returns a map of module name to rendered markdown so callers can inspect or
 * snapshot the output without reading the file system back.
 */
async function writeMarkdownSplit(components: ComponentDocs, options: WriteMarkdownOptions) {
  const write = options?.write !== false;
  const outDir = options.outDir ?? DEFAULT_MARKDOWN_OUT_DIR;
  const renderOptions = pickRenderOptions(options);
  const files = new Map<string, string>();

  const keys = Array.from(components.keys()).sort();
  for (const key of keys) {
    const component = components.get(key);
    if (!component) continue;

    const document = new WriterMarkdown({});
    renderComponentFile(document, component, renderOptions);
    files.set(component.moduleName, document.end());
  }

  if (write) {
    await Promise.all(
      Array.from(files, async ([moduleName, content]) => {
        const relativePath = join(outDir, `${moduleName}.md`);
        const writer = new WriterMarkdown({});
        await writer.write(join(process.cwd(), relativePath), content);
        console.log(`created "${relativePath}".`);
      }),
    );
  }

  return files;
}

/**
 * Renders component docs to markdown and optionally writes them.
 *
 * Writes a single document to `outFile` by default. When `split` is enabled,
 * writes one file per component into `outDir` and resolves to a map of module
 * name to rendered markdown.
 *
 * @example
 * ```ts
 * const markdown = await writeMarkdown(components, {
 *   outFile: "COMPONENTS.md",
 *   write: true,
 *   onAppend: (type, doc) => {
 *     console.log(`Appended ${type}`);
 *   }
 * });
 *
 * // Split mode (one file per component):
 * await writeMarkdown(components, {
 *   outFile: "COMPONENTS.md",
 *   split: true,
 *   outDir: "docs",
 *   frontmatter: true
 * });
 * ```
 */
export default async function writeMarkdown(components: ComponentDocs, options: WriteMarkdownOptions) {
  if (options.split) {
    return writeMarkdownSplit(components, options);
  }

  const write = options?.write !== false;
  const document = new WriterMarkdown({
    onAppend: (type, document) => {
      options.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components, pickRenderOptions(options));

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    await document.write(outFile, document.end());
    console.log(`created "${options.outFile}".`);
  }

  return document.end();
}
