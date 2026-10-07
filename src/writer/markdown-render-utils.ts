import type { ComponentProp } from "../model";
import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument } from "./document-model";
import type { AppendType } from "./markdown-document";
import {
  CSS_PART_TABLE_HEADER,
  CSS_PROPERTY_TABLE_HEADER,
  EVENT_TABLE_HEADER,
  EXPORT_TABLE_HEADER,
  formatDescriptionWithTags,
  formatEventDetail,
  formatExportType,
  formatNameWithDeprecation,
  formatPropDescription,
  formatPropType,
  formatPropValue,
  formatSlotFallback,
  formatSlotProps,
  MD_TYPE_UNDEFINED,
  PROP_TABLE_HEADER,
  renderClassMemberTables,
  SLOT_TABLE_HEADER,
  WHITESPACE_REGEX,
} from "./markdown-format-utils";
import { getTypeDefs } from "./writer-ts-definitions-core";

/**
 * The part of `MarkdownDocument` the renderers call. `renderComponentsToMarkdown`
 * is public, so it keeps accepting any object with this shape.
 */
interface MarkdownRenderTarget {
  append(type: AppendType, raw?: string): MarkdownRenderTarget;
  tableOfContents(): MarkdownRenderTarget;
}

export function renderComponentsToMarkdown(
  document: MarkdownRenderTarget,
  components: ComponentDocs,
  entryExports?: EntryExports,
) {
  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  if (entryExports && entryExports.length > 0) {
    renderExports(document, entryExports);
  }

  for (const component of buildComponentApiDocument(components).components) {
    renderComponentToMarkdown(document, component);
  }
}

/** The `markdownOptions.outDir` index page: links to each component's own file, then Exports. */
export function renderComponentIndexToMarkdown(
  document: MarkdownRenderTarget,
  components: ComponentDocApi[],
  entryExports?: EntryExports,
) {
  document.append("h1", "Component Index");
  document.append("h2", "Components");
  for (const component of components) {
    document.append("raw", `- [${component.moduleName}](./${component.moduleName}.md)\n`);
  }
  document.append("raw", "\n");
  document.append("divider");

  if (entryExports && entryExports.length > 0) {
    renderExports(document, entryExports);
  }
}

function renderExports(document: MarkdownRenderTarget, entryExports: EntryExports) {
  document.append("h2", "Exports");
  document.append("raw", EXPORT_TABLE_HEADER);

  for (const entry of entryExports) {
    // Keeps multi-line types (e.g. interface bodies) on one table row.
    const type = (entry.type ?? entry.value)?.replace(WHITESPACE_REGEX, " ").trim();
    document.append(
      "raw",
      `| ${formatNameWithDeprecation(entry.name, entry.deprecated)} | <code>${entry.kind}</code> | ${formatPropType(type)} | ${formatPropDescription(
        entry.description,
      )} |\n`,
    );
  }

  document.append("raw", "\n");
  document.append("divider");
}

/** Mirrors the `.d.ts` writer's `genAccessors` filter. */
function isAccessorProp(prop: ComponentProp): boolean {
  return prop.kind === "const" || prop.isFunctionDeclaration;
}

function renderModuleExports(document: MarkdownRenderTarget, moduleExports: ComponentProp[]) {
  document.append("h3", "Module exports");
  document.append("raw", EXPORT_TABLE_HEADER);
  for (const moduleExport of moduleExports) {
    document.append(
      "raw",
      `| ${formatNameWithDeprecation(moduleExport.name, moduleExport.deprecated)} | <code>${moduleExport.kind}</code> | ${formatExportType(moduleExport)} | ${formatDescriptionWithTags(moduleExport.description, moduleExport.tags)} |\n`,
    );
  }
  document.append("raw", "\n");
  renderClassMemberTables(document, moduleExports);
}

function renderSectionIfNotEmpty(document: MarkdownRenderTarget, items: readonly unknown[], renderFn: () => void) {
  if (items.length > 0) {
    renderFn();
    document.append("raw", "\n");
  } else {
    document.append("p", "None.");
  }
}

/** One component's section, for both the combined document and `outDir`'s per-component files. */
export function renderComponentToMarkdown(document: MarkdownRenderTarget, component: ComponentDocApi) {
  document.append("h2", `\`${component.moduleName}\``);

  // Without this, generic names like `Row` would appear in the tables undefined.
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
    const rank = (prop: (typeof component.props)[number]) => (prop.reactive ? 0 : prop.constant ? 2 : 1);
    const sortedProps = component.props
      .map((prop, index) => ({ prop, index }))
      .sort((a, b) => rank(a.prop) - rank(b.prop) || a.index - b.index)
      .map(({ prop }) => prop);
    for (const prop of sortedProps) {
      const kind = isAccessorProp(prop) ? "accessor" : prop.kind;
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(prop.name, prop.deprecated)} | ${prop.isRequired ? "Yes" : "No"} | <code>${kind}</code> | ${
          prop.reactive ? "Yes" : "No"
        } | ${prop.binding ?? "--"} | ${formatPropType(prop.type)} | ${formatPropValue(prop.value)} | ${formatDescriptionWithTags(
          prop.description,
          prop.tags,
        )} |\n`,
      );
    }
  });

  if (component.moduleExports.length > 0) {
    renderModuleExports(document, component.moduleExports);
  }

  document.append("h3", "Slots");
  renderSectionIfNotEmpty(document, component.slots, () => {
    document.append("raw", SLOT_TABLE_HEADER);
    for (const slot of component.slots) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(slot.default ? MD_TYPE_UNDEFINED : (slot.name ?? MD_TYPE_UNDEFINED), slot.deprecated)} | ${slot.default ? "Yes" : "No"} | ${formatSlotProps(
          slot.slot_props,
        )} | ${formatSlotFallback(slot.fallback)} | ${formatDescriptionWithTags(slot.description, slot.tags)} |\n`,
      );
    }
  });

  document.append("h3", "Events");
  renderSectionIfNotEmpty(document, component.events, () => {
    document.append("raw", EVENT_TABLE_HEADER);
    for (const event of component.events) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(event.name, event.deprecated)} | ${event.type} | ${formatEventDetail(
          event.detail,
        )} | ${formatDescriptionWithTags(event.description, event.tags)} |\n`,
      );
    }
  });

  if (component.cssParts && component.cssParts.length > 0) {
    document.append("h3", "CSS Parts");
    document.append("raw", CSS_PART_TABLE_HEADER);
    for (const cssPart of component.cssParts) {
      document.append("raw", `| ${cssPart.name} | ${formatPropDescription(cssPart.description)} |\n`);
    }
    document.append("raw", "\n");
  }

  if (component.cssProperties && component.cssProperties.length > 0) {
    document.append("h3", "CSS Custom Properties");
    document.append("raw", CSS_PROPERTY_TABLE_HEADER);
    for (const cssProperty of component.cssProperties) {
      document.append(
        "raw",
        `| ${cssProperty.name} | ${formatPropType(cssProperty.type)} | ${formatPropValue(cssProperty.default)} | ${formatPropDescription(
          cssProperty.description,
        )} |\n`,
      );
    }
    document.append("raw", "\n");
  }
}
