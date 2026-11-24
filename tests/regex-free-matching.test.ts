import { containsWord, escapeRegExp } from "../src/parser/utils";
import { closesFence } from "../src/writer/markdown-format-utils";

// The regexes these replace are the oracle: every short string over an
// alphabet with word characters, `$`, spaces, tabs and fence characters.
function* strings(alphabet: string, maxLength: number): Generator<string> {
  yield "";
  let level = [""];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[] = [];
    for (const prefix of level) for (const char of alphabet) next.push(prefix + char);
    yield* next;
    level = next;
  }
}

describe("containsWord", () => {
  test("matches \\b<word>\\b for every word and text over a small alphabet", () => {
    const words = [...strings("a$_ ", 2)];
    const texts = [...strings("a$_ .", 4)];
    for (const word of words) {
      const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`);
      for (const text of texts) expect([word, text, containsWord(text, word)]).toEqual([word, text, regex.test(text)]);
    }
  });

  test("finds a generic name in type text", () => {
    expect(containsWord("Array<Row>", "Row")).toBe(true);
    expect(containsWord("Array<RowItem>", "Row")).toBe(false);
  });
});

describe("closesFence", () => {
  test("matches the closing-fence regex for every line over a small alphabet", () => {
    const lines = [...strings("`~ \tx", 5)];
    for (const fence of ["```", "````", "~~~"]) {
      const char = fence[0] ?? "";
      const regex = new RegExp(`^[ \\t]*${char}{${fence.length},}[ \\t]*$`);
      for (const line of lines)
        expect([fence, line, closesFence(line, fence)]).toEqual([fence, line, regex.test(line)]);
    }
  });
});
