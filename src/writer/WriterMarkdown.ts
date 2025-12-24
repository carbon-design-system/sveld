import Writer from "./Writer";

const BACKTICK_REGEX = /`/g;
const WHITESPACE_REGEX = /\s+/g;

type OnAppend = (type: AppendType, document: WriterMarkdown) => void;

interface MarkdownOptions {
  onAppend?: OnAppend;
}

export type AppendType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "p" | "divider" | "raw";

interface TocLine {
  array: number[];
  raw: string;
}

export default class WriterMarkdown extends Writer {
  onAppend?: OnAppend;
  private sourceParts: string[] = [];
  hasToC = false;
  toc: TocLine[] = [];

  constructor(options: MarkdownOptions) {
    super({ parser: "markdown", printWidth: 80 });
    this.onAppend = options.onAppend;
  }

  public get source(): string {
    return this.sourceParts.join("");
  }

  public appendLineBreaks() {
    this.sourceParts.push("\n\n");
    return this;
  }

  public append(type: AppendType, raw?: string) {
    switch (type) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const length = Number(type.slice(-1));

        this.sourceParts.push(`${"#".repeat(length)} ${raw}`);

        if (this.hasToC && type === "h2") {
          this.toc.push({
            array: Array.from({ length: (length - 1) * 2 }),
            raw: raw ?? "",
          });
        }
        break;
      }
      case "quote":
        this.sourceParts.push(`> ${raw}`);
        break;
      case "p":
        this.sourceParts.push(raw ?? "");
        break;
      case "divider":
        this.sourceParts.push("---");
        break;
      case "raw":
        this.sourceParts.push(raw ?? "");
        break;
    }

    if (type !== "raw") this.appendLineBreaks();
    this.onAppend?.call(this, type, this);
    return this;
  }

  public tableOfContents() {
    this.sourceParts.push("<!-- __TOC__ -->");
    this.hasToC = true;
    this.appendLineBreaks();
    return this;
  }

  public end() {
    const source = this.sourceParts.join("");
    return source.replace(
      "<!-- __TOC__ -->",
      this.toc
        .map(({ array, raw }) => {
          return `${array.join(" ")} - [${raw}](#${raw.toLowerCase().replace(BACKTICK_REGEX, "").replace(WHITESPACE_REGEX, "-")})`;
        })
        .join("\n"),
    );
  }
}
