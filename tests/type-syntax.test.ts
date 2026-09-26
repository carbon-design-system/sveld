import { isValidTypeText } from "../src/template-parse/acorn-bridge";
import { isRecognizedTypeText } from "../src/template-parse/type-syntax";

/** The parser's verdict, bypassing the recognizer. */
function parserSaysValid(typeText: string): boolean {
  // `isValidTypeText` consults the recognizer first; text it doesn't
  // recognize goes to the parser, so wrap it in a shape the recognizer
  // never accepts (a line break) to force the parse.
  return isValidTypeText(`\n${typeText}`);
}

const CORPUS = [
  "string",
  '"sm" | "md" | "lg"',
  "Item[] | null",
  "Array<{ id: string; label?: string }>",
  "(event: MouseEvent, detail?: { x: number }) => void",
  "Record<string, (value: unknown) => boolean>",
  "keyof HTMLElementTagNameMap",
  "typeof value",
  "[string, number]",
  "A & B | C[]",
  "Map<string, Set<number>>['size']",
  "-1 | 0 | 1.5",
  "{ [key: string]: any }",
  'typeof import("carbon-icons-svelte").CarbonIcon',
  'import("svelte").ComponentProps<import("svelte").SvelteComponent>',
];

const INSERTS = ["|", "&", "(", ")", "[", "]", "{", "}", "<", ">", ",", ";", ":", "?", ".", "=>", '"', " ", "a"];

describe("isRecognizedTypeText", () => {
  test("recognizes common JSDoc type shapes", () => {
    for (const typeText of CORPUS) expect([typeText, isRecognizedTypeText(typeText)]).toEqual([typeText, true]);
  });

  test("never calls text valid that the TypeScript parser rejects", () => {
    const unsound: string[] = [];
    const check = (typeText: string) => {
      if (isRecognizedTypeText(typeText) && !parserSaysValid(typeText)) unsound.push(typeText);
    };
    for (const typeText of CORPUS) {
      for (let i = 0; i <= typeText.length; i++) {
        check(typeText.slice(0, i) + typeText.slice(i + 1));
        for (const insert of INSERTS) check(typeText.slice(0, i) + insert + typeText.slice(i));
      }
    }
    expect(unsound).toEqual([]);
  });

  test("leaves invalid or unusual text to the parser", () => {
    for (const typeText of ['"a" | ', "Array<string", "?string", "Array.<string>", "class", "a\n| b"]) {
      expect([typeText, isRecognizedTypeText(typeText)]).toEqual([typeText, false]);
    }
  });
});
