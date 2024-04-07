import { getElementByTag } from "../src/element-tag-map";

test("getElementByTag", () => {
  expect(getElementByTag("")).toEqual("HTMLElement");
  expect(getElementByTag("div")).toEqual("HTMLDivElement");
  expect(getElementByTag("body")).toEqual("HTMLBodyElement");
});
