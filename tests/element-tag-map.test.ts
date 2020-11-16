import * as test from "tape";
import { getElementByTag } from "../src/element-tag-map";

test("getElementByTag", (t) => {
  t.equal(getElementByTag(""), "HTMLElement");
  t.equal(getElementByTag("div"), "HTMLDivElement");
  t.equal(getElementByTag("body"), "HTMLBodyElement");
  t.end();
});
