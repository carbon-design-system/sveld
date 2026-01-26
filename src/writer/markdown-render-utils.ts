import type { ComponentDocApi, ComponentDocs } from "../rollup-plugin";
import type { AppendType } from "./MarkdownWriterBase";
import {
  EVENT_TABLE_HEADER,
  formatEventDetail,
  formatPropDescription,
  formatPropType,
  formatPropValue,
  formatSlotFallback,
  formatSlotProps,
  MD_TYPE_UNDEFINED,
  PROP_TABLE_HEADER,
  SLOT_TABLE_HEADER,
} from "./markdown-format-utils";
import { getTypeDefs } from "./writer-ts-definitions-core";

/**
 * Interface for markdown documents that can be used for rendering.
 * Only requires the methods we actually use, not the full implementation.
 */
interface MarkdownDocument {
  append(type: AppendType, raw?: string): MarkdownDocument;
  tableOfContents(): MarkdownDocument;
}

/**
 * Renders component documentation to a markdown document.
 * This shared function is used by both writeMarkdown and writeMarkdownCore.
 */
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

/**
 * Renders a single component's documentation to the markdown document.
 */
function renderComponent(document: MarkdownDocument, component: ComponentDocApi) {
  document.append("h2", `\`${component.moduleName}\``);

  // Render typedefs
  if (component.typedefs.length > 0) {
    document.append("h3", "Types").append(
      "raw",
      `\`\`\`ts\n${getTypeDefs({
        typedefs: component.typedefs,
      })}\n\`\`\`\n\n`,
    );
  }

  // Render props
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

  // Render slots
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

  // Render events
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
