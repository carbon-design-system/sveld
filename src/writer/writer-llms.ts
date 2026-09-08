import path from "node:path";
import type { ComponentProp, ComponentSlot, SerializedComponentEvent } from "../ComponentParser";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import { normalizeSeparators } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { readProjectPackageMeta } from "../read-project-package-meta";
import { buildComponentApiDocument } from "./document-model";
import { MarkdownWriterBaseImpl } from "./MarkdownWriterBase";
import {
  EVENT_TABLE_HEADER,
  formatDescriptionWithTags,
  formatEventDetail,
  formatNameWithDeprecation,
  formatPropDescription,
  formatPropType,
  formatPropValue,
  formatSlotFallback,
  formatSlotProps,
  MD_TYPE_UNDEFINED,
  SLOT_TABLE_HEADER,
} from "./markdown-format-utils";
import Writer from "./Writer";
import { getTypeDefs } from "./writer-ts-definitions-core";

export interface WriteLlmsOptions {
  outDir?: string;
  /** Prefixed to each component's link path, e.g. `[Name](<linkBase>/Name)`. @default "" */
  linkBase?: string;
  /** @default the "name" field from the project's package.json */
  title?: string;
  /** @default the "description" field from the project's package.json */
  summary?: string;
  /** @internal Entry-barrel exports when `documentExports` is on. Always computed from the parsed bundle and injected by the caller. */
  entryExports?: EntryExports;
  /** @internal Report the resolved paths instead of writing. Always set by the caller from `sveld --dry-run`. */
  dryRun?: boolean;
}

/** Terse 5-column table shared by every `ComponentProp[]`-shaped section (Props, Bindings, Module exports). */
const LLMS_PROP_TABLE_HEADER = "| Name | Type | Default | Required | Description |\n| :- | :- | :- | :- | :- |\n";

const SENTENCE_END_REGEX = /[.!?](?:\s|$)/;
const BLANK_LINE_REGEX = /\r?\n[ \t]*\r?\n/;
const WHITESPACE_RUN_REGEX = /\s+/g;

/** First sentence of the first paragraph of `text`, or `fallback` when `text` is empty. */
function firstSentence(text: string | undefined, fallback: string): string {
  if (!text) return fallback;

  const firstParagraph = text.trim().split(BLANK_LINE_REGEX)[0]?.replace(WHITESPACE_RUN_REGEX, " ").trim();
  if (!firstParagraph) return fallback;

  const match = SENTENCE_END_REGEX.exec(firstParagraph);
  return match ? firstParagraph.slice(0, match.index + 1) : firstParagraph;
}

function renderPropsTableSection(document: MarkdownWriterBaseImpl, heading: string, props: ComponentProp[]) {
  if (props.length === 0) return;

  document.append("h3", heading);
  document.append("raw", LLMS_PROP_TABLE_HEADER);
  for (const prop of props) {
    document.append(
      "raw",
      `| ${formatNameWithDeprecation(prop.name, prop.deprecated)} | ${formatPropType(prop.type)} | ${formatPropValue(
        prop.value,
      )} | ${prop.isRequired ? "Yes" : "No"} | ${formatPropDescription(prop.description)} |\n`,
    );
  }
  document.append("raw", "\n");
}

function renderEventsSection(document: MarkdownWriterBaseImpl, events: SerializedComponentEvent[]) {
  if (events.length === 0) return;

  document.append("h3", "Events");
  document.append("raw", EVENT_TABLE_HEADER);
  for (const event of events) {
    document.append(
      "raw",
      `| ${formatNameWithDeprecation(event.name, event.deprecated)} | ${event.type} | ${
        event.type === "dispatched" ? formatEventDetail(event.detail) : MD_TYPE_UNDEFINED
      } | ${formatPropDescription(event.description)} |\n`,
    );
  }
  document.append("raw", "\n");
}

function renderSlotsSection(document: MarkdownWriterBaseImpl, heading: string, slots: ComponentSlot[]) {
  if (slots.length === 0) return;

  document.append("h3", heading);
  document.append("raw", SLOT_TABLE_HEADER);
  for (const slot of slots) {
    document.append(
      "raw",
      `| ${formatNameWithDeprecation(slot.default ? MD_TYPE_UNDEFINED : (slot.name ?? MD_TYPE_UNDEFINED), slot.deprecated)} | ${
        slot.default ? "Yes" : "No"
      } | ${formatSlotProps(slot.slot_props)} | ${formatSlotFallback(slot.fallback)} | ${formatDescriptionWithTags(
        slot.description,
        slot.tags,
      )} |\n`,
    );
  }
  document.append("raw", "\n");
}

function renderTypedefsSection(document: MarkdownWriterBaseImpl, component: ComponentDocApi) {
  if (component.typedefs.length === 0) return;

  document.append("h3", "Typedefs");
  document.append("raw", `\`\`\`ts\n${getTypeDefs({ typedefs: component.typedefs })}\n\`\`\`\n\n`);
}

function renderComponentFull(document: MarkdownWriterBaseImpl, component: ComponentDocApi) {
  document.append("h2", component.moduleName);

  if (component.generics) {
    document.append("p", `Type parameters: ${formatPropType(`<${component.generics[1]}>`)}`);
  }

  if (component.componentComment?.trim()) {
    document.append("p", component.componentComment.trim());
  }

  renderPropsTableSection(document, "Props", component.props);
  renderPropsTableSection(
    document,
    "Bindings",
    component.props.filter((prop) => prop.reactive),
  );
  renderEventsSection(document, component.events);
  renderSlotsSection(document, component.syntaxMode === "runes" ? "Snippets" : "Slots", component.slots);
  renderTypedefsSection(document, component);
  renderPropsTableSection(document, "Module exports", component.moduleExports);
}

function renderLlmsTxt(
  components: ComponentDocApi[],
  title: string,
  summary: string | undefined,
  options: WriteLlmsOptions,
): string {
  const document = new MarkdownWriterBaseImpl();
  const linkBase = options.linkBase ?? "";

  document.append("h1", title);
  if (summary) document.append("quote", summary);

  document.append("h2", "Components");
  for (const component of components) {
    document.append(
      "raw",
      `- [${component.moduleName}](${linkBase}/${component.moduleName}): ${firstSentence(component.componentComment, "Component")}\n`,
    );
  }
  document.append("raw", "\n");

  if (options.entryExports && options.entryExports.length > 0) {
    document.append("h2", "Exports");
    for (const entry of options.entryExports) {
      document.append("raw", `- \`${entry.name}\`: ${firstSentence(entry.description, entry.kind)}\n`);
    }
    document.append("raw", "\n");
  }

  return document.end();
}

function renderLlmsFullTxt(components: ComponentDocApi[], title: string, summary: string | undefined): string {
  const document = new MarkdownWriterBaseImpl();

  document.append("h1", title);
  if (summary) document.append("quote", summary);

  for (const component of components) {
    renderComponentFull(document, component);
  }

  return document.end();
}

/**
 * Renders both `llms.txt` (an index of links, per https://llmstxt.org) and
 * `llms-full.txt` (the flattened full reference) without touching disk. Used
 * by both `writeLlms` and tests so the two channels can't drift.
 */
export function renderLlmsDocuments(
  components: ComponentDocs,
  options: WriteLlmsOptions,
): { llmsTxt: string; llmsFullTxt: string } {
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const packageMeta = readProjectPackageMeta();
  const title = options.title ?? packageMeta.name ?? "Components";
  const summary = options.summary ?? packageMeta.description;

  return {
    llmsTxt: renderLlmsTxt(document.components, title, summary, options),
    llmsFullTxt: renderLlmsFullTxt(document.components, title, summary),
  };
}

/**
 * Writes a first-party `llms.txt` / `llms-full.txt` pair (per
 * https://llmstxt.org) alongside the usual output.
 *
 * @example
 * ```ts
 * await writeLlms(components, { outDir: ".", linkBase: "/docs" });
 * ```
 */
export default async function writeLlms(components: ComponentDocs, options: WriteLlmsOptions) {
  const { llmsTxt, llmsFullTxt } = renderLlmsDocuments(components, options);
  const writer = new Writer({ dryRun: options.dryRun });

  const llmsRelPath = normalizeSeparators(path.join(options.outDir ?? "", "llms.txt"));
  const llmsFullRelPath = normalizeSeparators(path.join(options.outDir ?? "", "llms-full.txt"));

  const [llmsWritten, llmsFullWritten] = await Promise.all([
    writer.write(path.join(process.cwd(), llmsRelPath), llmsTxt),
    writer.write(path.join(process.cwd(), llmsFullRelPath), llmsFullTxt),
  ]);

  if (!options.dryRun) {
    info(`${llmsWritten ? "created" : "unchanged"} "${llmsRelPath}".`);
    info(`${llmsFullWritten ? "created" : "unchanged"} "${llmsFullRelPath}".`);
  }
}
