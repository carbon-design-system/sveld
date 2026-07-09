import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";
import type { AppendType } from "./MarkdownWriterBase";
import {
  EVENT_TABLE_HEADER,
  EXPORT_TABLE_HEADER,
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
  WHITESPACE_REGEX,
} from "./markdown-format-utils";
import { getTypeDefs } from "./writer-ts-definitions-core";

/** Minimal markdown writer surface used by JSON and browser renderers. */
interface MarkdownDocument {
  append(type: AppendType, raw?: string): MarkdownDocument;
  tableOfContents(): MarkdownDocument;
}

export function renderComponentsToMarkdown(
  document: MarkdownDocument,
  components: ComponentDocs,
  entryExports?: EntryExports,
) {
  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  if (entryExports && entryExports.length > 0) {
    renderExports(document, entryExports);
  }

  const apiDocument = buildComponentApiDocument(components);

  for (const component of apiDocument.components) {
    renderComponent(document, component);
  }
}

function renderExports(document: MarkdownDocument, entryExports: EntryExports) {
  document.append("h2", "Exports");
  document.append("raw", EXPORT_TABLE_HEADER);

  for (const entry of entryExports) {
    // Collapse whitespace so multi-line types (e.g. interface bodies) stay on a
    // single table row. JSON retains the verbatim type text.
    const type = (entry.type ?? entry.value)?.replace(WHITESPACE_REGEX, " ").trim();
    document.append(
      "raw",
      `| ${entry.name} | ${`<code>${entry.kind}</code>`} | ${formatPropType(type)} | ${formatPropDescription(
        entry.description,
      )} |\n`,
    );
  }

  // "raw" appends (the table rows above) don't trailing-break themselves, so
  // without this the divider would butt directly against the last row.
  document.append("raw", "\n");
  document.append("divider");
}

function renderSectionIfNotEmpty<TItem>(
  document: MarkdownDocument,
  items: TItem[],
  renderFn: () => void,
  emptyMessage?: string,
) {
  if (items.length > 0) {
    renderFn();
    // Blank line after the table so the next heading isn't glued to its last row.
    document.append("raw", "\n");
  } else {
    document.append("p", emptyMessage ?? "None.");
  }
}

function renderComponent(document: MarkdownDocument, component: ComponentDocApi) {
  document.append("h2", `\`${component.moduleName}\``);

  // Prop/slot types can reference the component's own type parameters (e.g. `Row`
  // from `<script generics="Row extends DataTableRow">`). Markdown has no declaration
  // context like the generated `.d.ts` does, so without this the name would appear
  // in the tables below with nothing in the document defining what it means.
  if (component.generics) {
    document.append("p", `**Type parameters:** ${formatPropType(`<${component.generics[1]}>`)}`);
  }

  if (component.typedefs.length > 0) {
    document.append("h3", "Types").append(
      "raw",
      `\`\`\`ts\n${getTypeDefs({
        typedefs: component.typedefs,
      })}\n\`\`\`\n\n`,
    );
  }

  document.append("h3", "Props");
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

  document.append("h3", "Slots");
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

  document.append("h3", "Events");
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
