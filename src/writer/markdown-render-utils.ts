import type { ComponentDocApi, ComponentDocs } from "../plugin";
import type { AppendType } from "./MarkdownWriterBase";
import {
  EVENT_TABLE_HEADER,
  formatEventDetail,
  formatPropDescription,
  formatPropType,
  formatPropValue,
  formatSlotDescription,
  formatSlotFallback,
  formatSlotProps,
  MD_TYPE_UNDEFINED,
  PROP_TABLE_HEADER,
  SLOT_TABLE_HEADER,
} from "./markdown-format-utils";
import { getTypeDefs } from "./writer-ts-definitions-core";

/** Minimal markdown writer surface used by JSON and browser renderers. */
interface MarkdownDocument {
  append(type: AppendType, raw?: string): MarkdownDocument;
  tableOfContents(): MarkdownDocument;
}

export function renderComponentsToMarkdown(document: MarkdownDocument, components: ComponentDocs) {
  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  const keys = Array.from(components.keys()).sort();

  for (const key of keys) {
    const component = components.get(key);
    if (!component) continue;

    renderComponent(document, component);
  }
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

function renderComponent(document: MarkdownDocument, component: ComponentDocApi) {
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
        `| ${prop.name} | ${prop.isRequired ? "Yes" : "No"} | ${`<code>${prop.kind}</code>`} | ${
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
        `| ${slot.default ? MD_TYPE_UNDEFINED : slot.name} | ${slot.default ? "Yes" : "No"} | ${formatSlotProps(
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
        `| ${event.name} | ${event.type} | ${
          event.type === "dispatched" ? formatEventDetail(event.detail) : MD_TYPE_UNDEFINED
        } | ${formatPropDescription(event.description)} |\n`,
      );
    }
  });
}
