import { BACKTICK_REGEX } from "./markdown-format-utils";

const NON_SLUG_CHAR_REGEX = /[^\w\- ]+/g;
const SLUG_SPACE_REGEX = /\s+/g;

/**
 * Mirrors GitHub's heading slugger: lowercase, strip backticks, drop any
 * character that isn't a letter/number/space/hyphen/underscore, then turn
 * spaces into hyphens. Duplicate anchors get `-1`, `-2`, ... suffixes,
 * tracked via `seen`.
 */
function slugifyHeading(raw: string, seen: Map<string, number>): string {
  const slug = raw
    .toLowerCase()
    .replace(BACKTICK_REGEX, "")
    .replace(NON_SLUG_CHAR_REGEX, "")
    .replace(SLUG_SPACE_REGEX, "-");

  const count = seen.get(slug) ?? 0;
  seen.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
}

export type AppendType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "p" | "divider" | "raw";

export interface TocLine {
  /** Leading space count; 0 for the top-level (`h2`) entries the TOC currently lists. */
  indent: number;
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
          this.toc.push({ indent: 0, raw: raw ?? "" });
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
    const seenAnchors = new Map<string, number>();
    return source.replace(
      "<!-- __TOC__ -->",
      this.toc
        .map(({ indent, raw }) => {
          return `${" ".repeat(indent)}- [${raw}](#${slugifyHeading(raw, seenAnchors)})`;
        })
        .join("\n"),
    );
  }
}
