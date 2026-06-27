import type { ComponentDocApi, ComponentDocs } from "../plugin";
import type { AppendType } from "./MarkdownWriterBase";
import {
  EVENT_TABLE_HEADER,
  formatEventDetail,
  formatNameWithDeprecation,
  formatPropDescription,
  formatPropType,
  formatPropValue,
  formatSlotDescription,
  formatSlotFallback,
  formatSlotProps,
  MD_TYPE_UNDEFINED,
  PROP_TABLE_HEADER,
  SLOT_TABLE_HEADER,
  slugify,
} from "./markdown-format-utils";
import { getTypeDefs } from "./writer-ts-definitions-core";

/** Minimal markdown writer surface used by JSON and browser renderers. */
interface MarkdownDocument {
  append(type: AppendType, raw?: string): MarkdownDocument;
  tableOfContents(): MarkdownDocument;
}

/**
 * Opt-in enhancements for doc-site consumption.
 *
 * All options default to `false` so that the single-file output remains
 * byte-stable unless a caller explicitly turns a feature on.
 */
export interface MarkdownRenderOptions {
  /** Emit YAML frontmatter (name, since, deprecated). Applies to split files. */
  frontmatter?: boolean;
  /** Emit a per-component table of contents linking to each section. */
  toc?: boolean;
  /** Emit stable, slugified heading anchors before each component heading. */
  anchors?: boolean;
}

const SINCE_REGEX = /@since\s+(\S+)/;
const DEPRECATED_REGEX = /@deprecated\b[ \t]*([^\n]*)/;

interface ComponentMeta {
  since?: string;
  deprecated?: string | true;
}

/**
 * Extract `@since` and `@deprecated` metadata from a component's `@component`
 * comment. `@deprecated` resolves to the trailing reason text when present,
 * otherwise `true`.
 */
function extractComponentMeta(component: ComponentDocApi): ComponentMeta {
  const comment = component.componentComment ?? "";
  const meta: ComponentMeta = {};

  const since = comment.match(SINCE_REGEX)?.[1];
  if (since) meta.since = since;

  const deprecated = comment.match(DEPRECATED_REGEX);
  if (deprecated) {
    const reason = deprecated[1].trim();
    meta.deprecated = reason.length > 0 ? reason : true;
  }

  return meta;
}

/** Render a YAML frontmatter block describing the component. */
function renderFrontmatter(document: MarkdownDocument, component: ComponentDocApi) {
  const { since, deprecated } = extractComponentMeta(component);
  const lines = [`name: ${JSON.stringify(component.moduleName)}`];

  if (since) lines.push(`since: ${JSON.stringify(since)}`);
  if (deprecated !== undefined) {
    lines.push(typeof deprecated === "string" ? `deprecated: ${JSON.stringify(deprecated)}` : "deprecated: true");
  }

  document.append("raw", `---\n${lines.join("\n")}\n---\n\n`);
}

/**
 * Append a heading, optionally preceded by a stable HTML anchor.
 *
 * The explicit `<a id>` anchor keeps fragment links stable across markdown
 * renderers (some derive ids from heading text, some do not).
 */
function appendHeading(
  document: MarkdownDocument,
  type: AppendType,
  text: string,
  slug: string,
  options: MarkdownRenderOptions,
) {
  if (options.anchors) document.append("raw", `<a id="${slug}"></a>\n\n`);
  document.append(type, text);
}

export function renderComponentsToMarkdown(
  document: MarkdownDocument,
  components: ComponentDocs,
  options: MarkdownRenderOptions = {},
) {
  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  const keys = Array.from(components.keys()).sort();

  for (const key of keys) {
    const component = components.get(key);
    if (!component) continue;

    renderComponent(document, component, options);
  }
}

/**
 * Render a single component as a standalone document (used by split mode).
 *
 * Emits optional frontmatter at the top of the file followed by the component
 * body. Frontmatter is only meaningful at the top of a file, which is why it
 * lives here rather than in {@link renderComponentsToMarkdown}.
 */
export function renderComponentFile(
  document: MarkdownDocument,
  component: ComponentDocApi,
  options: MarkdownRenderOptions = {},
) {
  if (options.frontmatter) renderFrontmatter(document, component);
  renderComponent(document, component, options);
}

function renderSectionIfNotEmpty<TItem>(
  document: MarkdownDocument,
  items: TItem[],
  renderFn: () => void,
  emptyMessage?: string,
) {
  if (items.length > 0) {
    renderFn();
  } else {
    document.append("p", emptyMessage ?? "None.");
  }
}

/** Render the per-component table of contents linking to each section anchor. */
function renderComponentToc(document: MarkdownDocument, sections: string[], slugBase: string) {
  for (const section of sections) {
    document.append("raw", `- [${section}](#${slugBase}-${slugify(section)})\n`);
  }
  document.append("raw", "\n");
}

function renderComponent(document: MarkdownDocument, component: ComponentDocApi, options: MarkdownRenderOptions = {}) {
  const slugBase = slugify(component.moduleName);
  const hasTypes = component.typedefs.length > 0;

  appendHeading(document, "h2", `\`${component.moduleName}\``, slugBase, options);

  if (options.toc) {
    const sections = [...(hasTypes ? ["Types"] : []), "Props", "Slots", "Events"];
    renderComponentToc(document, sections, slugBase);
  }

  if (hasTypes) {
    appendHeading(document, "h3", "Types", `${slugBase}-types`, options);
    document.append(
      "raw",
      `\`\`\`ts\n${getTypeDefs({
        typedefs: component.typedefs,
      })}\n\`\`\`\n\n`,
    );
  }

  appendHeading(document, "h3", "Props", `${slugBase}-props`, options);
  renderSectionIfNotEmpty(document, component.props, () => {
    document.append("raw", PROP_TABLE_HEADER);
    const sortedProps = [...component.props].sort((a) => {
      if (a.reactive) return -1;
      if (a.constant) return 1;
      return 0;
    });
    for (const prop of sortedProps) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(prop.name, prop.deprecated)} | ${prop.isRequired ? "Yes" : "No"} | ${`<code>${prop.kind}</code>`} | ${
          prop.reactive ? "Yes" : "No"
        } | ${prop.binding ?? "--"} | ${formatPropType(prop.type)} | ${formatPropValue(prop.value)} | ${formatPropDescription(
          prop.description,
        )} |\n`,
      );
    }
  });

  appendHeading(document, "h3", "Slots", `${slugBase}-slots`, options);
  renderSectionIfNotEmpty(document, component.slots, () => {
    document.append("raw", SLOT_TABLE_HEADER);
    for (const slot of component.slots) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(slot.default ? MD_TYPE_UNDEFINED : (slot.name ?? MD_TYPE_UNDEFINED), slot.deprecated)} | ${slot.default ? "Yes" : "No"} | ${formatSlotProps(
          slot.slot_props,
        )} | ${formatSlotFallback(slot.fallback)} | ${formatSlotDescription(slot.description, slot.tags)} |\n`,
      );
    }
  });

  appendHeading(document, "h3", "Events", `${slugBase}-events`, options);
  renderSectionIfNotEmpty(document, component.events, () => {
    document.append("raw", EVENT_TABLE_HEADER);
    for (const event of component.events) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(event.name, event.deprecated)} | ${event.type} | ${
          event.type === "dispatched" ? formatEventDetail(event.detail) : MD_TYPE_UNDEFINED
        } | ${formatPropDescription(event.description)} |\n`,
      );
    }
  });
}
