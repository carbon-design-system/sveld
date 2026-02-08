import type { ComponentDocs } from "../plugin";
import { type AppendType, MarkdownWriterBaseImpl } from "./MarkdownWriterBase";
import { renderComponentsToMarkdown } from "./markdown-render-utils";

export type { AppendType };

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

export interface WriteMarkdownCoreOptions {
  onAppend?: (type: AppendType, document: BrowserWriterMarkdown, components: ComponentDocs) => void;
}

export function writeMarkdownCore(components: ComponentDocs, options?: WriteMarkdownCoreOptions): string {
  const document = new BrowserWriterMarkdown({
    onAppend: (type, document) => {
      options?.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components);

  return document.end();
}
