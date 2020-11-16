import * as test from "tape";
import WriterMarkdown, { AppendType } from "../src/writer/WriterMarkdown";

test("WriterMarkdown", (t) => {
  const types: AppendType[] = [];
  const document = new WriterMarkdown({
    onAppend: (type) => {
      types.push(type);
    },
  });

  document.append("h1", "Component Index");
  document.append("h2", "Components").tableOfContents();
  document.append("divider");

  t.equal(document.end(), "# Component Index\n\n## Components\n\n\n\n---\n\n");

  document.append("raw", "> Quote");
  document.append("p", "Text");

  t.equal(document.end(), "# Component Index\n\n## Components\n\n\n\n---\n\n> QuoteText\n\n");
  t.deepEqual(types, ["h1", "h2", "divider", "raw", "p"]);
  t.end();
});
