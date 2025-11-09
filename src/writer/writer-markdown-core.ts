import type { ComponentDocs } from "../rollup-plugin";
import { formatTsProps, getTypeDefs } from "./writer-ts-definitions-core";

export type AppendType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "quote" | "p" | "divider" | "raw";

const BACKTICK_REGEX = /`/g;
const WHITESPACE_REGEX = /\s+/g;

type OnAppend = (type: AppendType, document: BrowserWriterMarkdown) => void;

interface MarkdownOptions {
  onAppend?: OnAppend;
}

interface TocLine {
  array: number[];
  raw: string;
}

// Browser-compatible WriterMarkdown that doesn't extend Writer
export class BrowserWriterMarkdown {
  onAppend?: OnAppend;
  source = "";
  hasToC = false;
  toc: TocLine[] = [];

  constructor(options: MarkdownOptions) {
    this.onAppend = options.onAppend;
  }

  public appendLineBreaks() {
    this.source += "\n\n";
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

        this.source += `${Array.from({ length })
          .map((_) => "#")
          .join("")} ${raw}`;

        if (this.hasToC && type === "h2") {
          this.toc.push({
            array: Array.from({ length: (length - 1) * 2 }),
            raw: raw ?? "",
          });
        }
        break;
      }
      case "quote":
        this.source += `> ${raw}`;
        break;
      case "p":
        this.source += raw;
        break;
      case "divider":
        this.source += "---";
        break;
      case "raw":
        this.source += raw;
        break;
    }

    if (type !== "raw") this.appendLineBreaks();
    this.onAppend?.call(this, type, this);
    return this;
  }

  public tableOfContents() {
    this.source += "<!-- __TOC__ -->";
    this.hasToC = true;
    this.appendLineBreaks();
    return this;
  }

  public end() {
    this.source = this.source.replace(
      "<!-- __TOC__ -->",
      this.toc
        .map(({ array, raw }) => {
          return `${array.join(" ")} - [${raw}](#${raw.toLowerCase().replace(BACKTICK_REGEX, "").replace(WHITESPACE_REGEX, "-")})`;
        })
        .join("\n"),
    );

    return this.source;
  }
}

const PROP_TABLE_HEADER =
  "| Prop name | Required | Kind | Reactive | Type | Default value | Description |\n| :- | :- | :- | :- |\n";
const SLOT_TABLE_HEADER = "| Slot name | Default | Props | Fallback |\n| :- | :- | :- | :- |\n";
const EVENT_TABLE_HEADER = "| Event name | Type | Detail | Description |\n| :- | :- | :- | :- |\n";
const MD_TYPE_UNDEFINED = "--";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;

function formatPropType(type?: string) {
  if (type === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${type.replace(PIPE_REGEX, "&#124;")}</code>`;
}

function escapeHtml(text: string) {
  return text.replace(LT_REGEX, "&lt;").replace(GT_REGEX, "&gt;");
}

function formatPropValue(value: string | undefined) {
  if (value === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${value.replace(BACKTICK_REGEX, "\\`").replace(PIPE_REGEX, "&#124;")}</code>`;
}

function formatPropDescription(description: string | undefined) {
  if (description === undefined || description.trim().length === 0) return MD_TYPE_UNDEFINED;
  return escapeHtml(description).replace(NEWLINE_REGEX, "<br />");
}

function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(escapeHtml(fallback).replace(NEWLINE_REGEX, "<br />"));
}

function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
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

  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  const keys = Array.from(components.keys()).sort();

  for (const key of keys) {
    const component = components.get(key);
    if (!component) continue;

    document.append("h2", `\`${component.moduleName}\``);

    if (component.typedefs.length > 0) {
      document.append("h3", "Types").append(
        "raw",
        `\`\`\`ts\n${getTypeDefs({
          typedefs: component.typedefs,
        })}\n\`\`\`\n\n`,
      );
    }

    document.append("h3", "Props");
    if (component.props.length > 0) {
      document.append("raw", PROP_TABLE_HEADER);
      const sortedProps = [...component.props].sort((a) => {
        if (a.reactive) return -1;
        if (a.constant) return 1;
        return 0;
      });
      for (const prop of sortedProps) {
        document.append(
          "raw",
          `| ${prop.name} | ${prop.isRequired ? "Yes" : "No"} | ${`<code>${prop.kind}</code>`} | ${
            prop.reactive ? "Yes" : "No"
          } | ${formatPropType(prop.type)} | ${formatPropValue(prop.value)} | ${formatPropDescription(
            prop.description,
          )} |\n`,
        );
      }
    } else {
      document.append("p", "None.");
    }

    document.append("h3", "Slots");
    if (component.slots.length > 0) {
      document.append("raw", SLOT_TABLE_HEADER);
      for (const slot of component.slots) {
        document.append(
          "raw",
          `| ${slot.default ? MD_TYPE_UNDEFINED : slot.name} | ${slot.default ? "Yes" : "No"} | ${formatSlotProps(
            slot.slot_props,
          )} | ${formatSlotFallback(slot.fallback)} |\n`,
        );
      }
    } else {
      document.append("p", "None.");
    }

    document.append("h3", "Events");

    if (component.events.length > 0) {
      document.append("raw", EVENT_TABLE_HEADER);
      for (const event of component.events) {
        document.append(
          "raw",
          `| ${event.name} | ${event.type} | ${
            event.type === "dispatched" ? formatEventDetail(event.detail) : MD_TYPE_UNDEFINED
          } | ${formatPropDescription(event.description)} |\n`,
        );
      }
    } else {
      document.append("p", "None.");
    }
  }

  return document.end();
}
