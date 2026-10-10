import { Glob } from "bun";
import { getElementByTag } from "../src/element-tag-map";

test("getElementByTag", () => {
  expect(getElementByTag("")).toEqual("HTMLElement");
  expect(getElementByTag("div")).toEqual("HTMLDivElement");
  expect(getElementByTag("body")).toEqual("HTMLBodyElement");
});

test("getElementByTag types SVG elements", () => {
  expect(getElementByTag("svg")).toEqual("SVGSVGElement");
  expect(getElementByTag("path")).toEqual("SVGPathElement");
  expect(getElementByTag("foreignObject")).toEqual("SVGForeignObjectElement");
  expect(getElementByTag("unknown-element", "svg")).toEqual("SVGElement");
});

test("getElementByTag reads a tag both namespaces define by namespace", () => {
  for (const [tag, html, svg] of [
    ["a", "HTMLAnchorElement", "SVGAElement"],
    ["script", "HTMLScriptElement", "SVGScriptElement"],
    ["style", "HTMLStyleElement", "SVGStyleElement"],
    ["title", "HTMLTitleElement", "SVGTitleElement"],
  ]) {
    expect(getElementByTag(tag)).toEqual(html);
    expect(getElementByTag(tag, "html")).toEqual(html);
    expect(getElementByTag(tag, "svg")).toEqual(svg);
  }
});

/** `"tag": Type;` members of `interface name` in a `lib.dom.d.ts`. */
function tagNameMap(libDom: string, name: string): Map<string, string> {
  const body = libDom.match(new RegExp(`interface ${name} \\{([^}]*)\\}`))?.[1];
  if (body === undefined) throw new Error(`no ${name} in lib.dom.d.ts`);
  return new Map([...body.matchAll(/"([\w-]+)": (\w+);/g)].map(([, tag, type]) => [tag, type]));
}

test("getElementByTag matches TypeScript's lib.dom.d.ts", async () => {
  const libDoms = await Array.fromAsync(
    new Glob("node_modules/@typescript/*/lib/lib.dom.d.ts").scan({ cwd: `${import.meta.dir}/..`, absolute: true }),
  );
  expect(libDoms.length).toBeGreaterThan(0);

  const sources = await Promise.all(libDoms.map(async (path) => [path, await Bun.file(path).text()] as const));
  for (const [path, libDom] of sources) {
    for (const [tag, type] of tagNameMap(libDom, "HTMLElementTagNameMap")) {
      expect({ path, tag, type: getElementByTag(tag, "html") }).toEqual({ path, tag, type });
    }
    for (const [tag, type] of tagNameMap(libDom, "HTMLElementDeprecatedTagNameMap")) {
      expect({ path, tag, type: getElementByTag(tag, "html") }).toEqual({ path, tag, type });
    }
    for (const [tag, type] of tagNameMap(libDom, "SVGElementTagNameMap")) {
      expect({ path, tag, type: getElementByTag(tag, "svg") }).toEqual({ path, tag, type });
    }
  }
});
