import { BACKTICK_REGEX, WHITESPACE_REGEX } from "./markdown-format-utils";

export type AppendType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "p" | "divider" | "raw";

export interface TocLine {
  array: number[];
  raw: string;
}

export interface MarkdownWriterBase {
  sourceParts: string[];
  hasToC: boolean;
  toc: TocLine[];
  appendLineBreaks(): this;
  append(type: AppendType, raw?: string): this;
  tableOfContents(): this;
  end(): string;
  get source(): string;
}

/**
 * Base class containing shared markdown writing logic.
 * This can be extended or used via composition.
 */
export class MarkdownWriterBaseImpl implements MarkdownWriterBase {
  public sourceParts: string[] = [];
  public hasToC = false;
  public toc: TocLine[] = [];

  public get source(): string {
    return this.sourceParts.join("");
  }

  public appendLineBreaks(): this {
    this.sourceParts.push("\n\n");
    return this;
  }

  public append(type: AppendType, raw?: string): this {
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
    return this;
  }

  public tableOfContents(): this {
    this.sourceParts.push("<!-- __TOC__ -->");
    this.hasToC = true;
    this.appendLineBreaks();
    return this;
  }

  public end(): string {
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
