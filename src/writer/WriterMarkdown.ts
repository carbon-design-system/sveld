import { type AppendType, MarkdownWriterBaseImpl } from "./MarkdownWriterBase";
import Writer from "./Writer";

type OnAppend = (type: AppendType, document: WriterMarkdown) => void;

interface MarkdownOptions {
  onAppend?: OnAppend;
}

export type { AppendType };

/**
 * Markdown writer that extends Writer for file operations.
 *
 * Combines file writing capabilities from Writer with markdown
 * generation capabilities from MarkdownWriterBaseImpl. Supports
 * callbacks for monitoring document construction.
 *
 * @example
 * ```ts
 * const writer = new WriterMarkdown({
 *   onAppend: (type, doc) => {
 *     console.log(`Appended ${type} to markdown`);
 *   }
 * });
 * writer.append("h1", "Title");
 * await writer.write("./docs.md", writer.end());
 * ```
 */
export default class WriterMarkdown extends Writer {
  onAppend?: OnAppend;
  private markdownBase: MarkdownWriterBaseImpl;

  /**
   * Creates a new WriterMarkdown instance.
   *
   * @param options - Markdown writer options including append callback
   */
  constructor(options: MarkdownOptions) {
    super({ parser: "markdown", printWidth: 80 });
    this.onAppend = options.onAppend;
    this.markdownBase = new MarkdownWriterBaseImpl();
  }

  public get source(): string {
    return this.markdownBase.source;
  }

  public get hasToC(): boolean {
    return this.markdownBase.hasToC;
  }

  public get toc() {
    return this.markdownBase.toc;
  }

  public appendLineBreaks() {
    this.markdownBase.appendLineBreaks();
    return this;
  }

  public append(type: AppendType, raw?: string) {
    this.markdownBase.append(type, raw);
    this.onAppend?.call(this, type, this);
    return this;
  }

  public tableOfContents() {
    this.markdownBase.tableOfContents();
    return this;
  }

  public end() {
    return this.markdownBase.end();
  }
}
