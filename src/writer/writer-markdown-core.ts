import type { EntryExports } from "../parse-entry-exports";
import type { ComponentDocs } from "../plugin";
import { type AppendType, MarkdownDocument } from "./markdown-document";
import { renderComponentsToMarkdown } from "./markdown-render-utils";

export interface WriteMarkdownCoreOptions {
  onAppend?: (type: AppendType, document: MarkdownDocument, components: ComponentDocs) => void;
}

export function createMarkdownDocument(
  components: ComponentDocs,
  options: WriteMarkdownCoreOptions | undefined,
): MarkdownDocument {
  return new MarkdownDocument({
    onAppend: (type, document) => {
      options?.onAppend?.call(null, type, document, components);
    },
  });
}

// Shared by `writeMarkdown`, the CLI's `--stdout` mode, and
// `writeMarkdownCore`, so they can't drift.
export function renderMarkdownDocument(
  components: ComponentDocs,
  options: WriteMarkdownCoreOptions & { entryExports?: EntryExports },
): string {
  const document = createMarkdownDocument(components, options);
  renderComponentsToMarkdown(document, components, options.entryExports);
  return document.end();
}

export function writeMarkdownCore(components: ComponentDocs, options?: WriteMarkdownCoreOptions): string {
  return renderMarkdownDocument(components, { onAppend: options?.onAppend });
}
