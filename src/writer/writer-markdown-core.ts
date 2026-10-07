import type { ComponentDocs } from "../plugin";
import { type AppendType, MarkdownDocument } from "./markdown-document";
import { renderComponentsToMarkdown } from "./markdown-render-utils";

export interface WriteMarkdownCoreOptions {
  onAppend?: (type: AppendType, document: MarkdownDocument, components: ComponentDocs) => void;
}

/** A document whose `onAppend` also receives `components`. */
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

export function writeMarkdownCore(components: ComponentDocs, options?: WriteMarkdownCoreOptions): string {
  const document = createMarkdownDocument(components, options);
  renderComponentsToMarkdown(document, components);
  return document.end();
}
