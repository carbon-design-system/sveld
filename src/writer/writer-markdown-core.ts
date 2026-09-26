import type { ComponentDocs } from "../plugin";
import { type AppendType, MarkdownDocument } from "./markdown-document";
import { renderComponentsToMarkdown } from "./markdown-render-utils";

export interface WriteMarkdownCoreOptions {
  onAppend?: (type: AppendType, document: MarkdownDocument, components: ComponentDocs) => void;
}

export function writeMarkdownCore(components: ComponentDocs, options?: WriteMarkdownCoreOptions): string {
  const document = new MarkdownDocument({
    onAppend: (type, document) => {
      options?.onAppend?.call(null, type, document, components);
    },
  });

  renderComponentsToMarkdown(document, components);

  return document.end();
}
