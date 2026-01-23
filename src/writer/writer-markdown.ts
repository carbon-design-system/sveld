import { join } from "node:path";
import type { ComponentDocs } from "../rollup-plugin";
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
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";
import { getTypeDefs } from "./writer-ts-definitions-core";

export interface WriteMarkdownOptions {
  write?: boolean;
  outFile: string;
  onAppend?: (type: AppendType, document: WriterMarkdown, components: ComponentDocs) => void;
}

export default async function writeMarkdown(components: ComponentDocs, options: WriteMarkdownOptions) {
  const write = options?.write !== false;
  const document = new WriterMarkdown({
    onAppend: (type, document) => {
      options.onAppend?.call(null, type, document, components);
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

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    await document.write(outFile, document.end());
    console.log(`created "${options.outFile}".`);
  }

  return document.end();
}
