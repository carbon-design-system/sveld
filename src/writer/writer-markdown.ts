import { join } from "node:path";
import type { ComponentDocs } from "../rollup-plugin";
import { renderComponentsToMarkdown } from "./markdown-render-utils";
import WriterMarkdown, { type AppendType } from "./WriterMarkdown";

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

  renderComponentsToMarkdown(document, components);

  if (write) {
    const outFile = join(process.cwd(), options.outFile);
    await document.write(outFile, document.end());
    console.log(`created "${options.outFile}".`);
  }

  return document.end();
}
