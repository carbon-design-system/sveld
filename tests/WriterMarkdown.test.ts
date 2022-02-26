import { test, expect } from "vitest";
import WriterMarkdown from "../src/writer/WriterMarkdown";
import type { AppendType } from "../src/writer/WriterMarkdown";

test("WriterMarkdown", () => {
  const types: AppendType[] = [];
  const document = new WriterMarkdown({
    onAppend: (type) => types.push(type),
  });

  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  expect(document.end()).toEqual("# Component Index\n\n## Components\n\n\n\n---\n\n");

  document.append("raw", "> Quote");
  document.append("p", "Text");

  expect(document.end()).toEqual("# Component Index\n\n## Components\n\n\n\n---\n\n> QuoteText\n\n");
  expect(types).toEqual(["h1", "h2", "divider", "raw", "p"]);
});
