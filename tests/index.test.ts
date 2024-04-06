import { expect, test } from "vitest";
import * as API from "../src";

test("Library exports", () => {
  expect(Object.keys(API)).toEqual(["default", "ComponentParser", "cli", "sveld"]);
});
