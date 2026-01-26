import { type AppendType, MarkdownWriterBaseImpl } from "./MarkdownWriterBase";
import Writer from "./Writer";

type OnAppend = (type: AppendType, document: WriterMarkdown) => void;

interface MarkdownOptions {
  onAppend?: OnAppend;
}

export type { AppendType };

export default class WriterMarkdown extends Writer {
  onAppend?: OnAppend;
  private markdownBase: MarkdownWriterBaseImpl;

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
