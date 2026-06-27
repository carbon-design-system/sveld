import type { ComponentDocs } from "../plugin";
import { type AppendType, MarkdownWriterBaseImpl } from "./MarkdownWriterBase";
import { type MarkdownRenderOptions, renderComponentFile, renderComponentsToMarkdown } from "./markdown-render-utils";

export type { AppendType, MarkdownRenderOptions };

type OnAppend = (type: AppendType, document: BrowserWriterMarkdown) => void;

interface MarkdownOptions {
  onAppend?: OnAppend;
}

/**
 * Browser-compatible WriterMarkdown that doesn't extend Writer.
 *
 * This class is designed for browser environments where file system operations
 * are not available. It extends MarkdownWriterBaseImpl directly instead of
 * Writer to avoid Node.js dependencies.
 *
 * @example
 * ```ts
 * const writer = new BrowserWriterMarkdown({
 *   onAppend: (type, doc) => {
 *     console.log(`Appended ${type} to document`);
 *   }
 * });
 * ```
 */
export class BrowserWriterMarkdown extends MarkdownWriterBaseImpl {
  onAppend?: OnAppend;

  constructor(options: MarkdownOptions) {
    super();
    this.onAppend = options.onAppend;
  }

  public override append(type: AppendType, raw?: string) {
    super.append(type, raw);
    this.onAppend?.call(this, type, this);
    return this;
  }
}

export interface WriteMarkdownCoreOptions extends MarkdownRenderOptions {
  onAppend?: (type: AppendType, document: BrowserWriterMarkdown, components: ComponentDocs) => void;
}

export function writeMarkdownCore(components: ComponentDocs, options?: WriteMarkdownCoreOptions): string {
  const document = new BrowserWriterMarkdown({
    onAppend: (type, document) => {
      options?.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components, options);

  return document.end();
}

/**
 * Render one markdown document per component.
 *
 * Browser-safe counterpart to split mode: returns a map of module name to
 * rendered markdown without touching the file system. Components are sorted by
 * module name to match the single-file ordering.
 *
 * @example
 * ```ts
 * const files = splitMarkdownCore(components, { frontmatter: true });
 * files.get("Button"); // "---\nname: \"Button\"\n---\n\n## `Button`\n\n..."
 * ```
 */
export function splitMarkdownCore(components: ComponentDocs, options?: MarkdownRenderOptions): Map<string, string> {
  const files = new Map<string, string>();
  const keys = Array.from(components.keys()).sort();

  for (const key of keys) {
    const component = components.get(key);
    if (!component) continue;

    const document = new BrowserWriterMarkdown({});
    renderComponentFile(document, component, options);
    files.set(component.moduleName, document.end());
  }

  return files;
}
