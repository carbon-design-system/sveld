import * as test from "tape";
import { getSvelteFiles } from "../src/get-svelte-files";

test("getSvelteFiles – file as entry", (t) => {
  const files = getSvelteFiles("tests/integration.js");

  t.equal(files.length > 0, true);
  t.deepEqual(files[0], { filePath: "tests/snapshots/bind-this/input.svelte", moduleName: "input" });
  t.end();
});

test("getSvelteFiles – directory as entry", (t) => {
  const files = getSvelteFiles("tests/snapshots");

  t.equal(files.length > 0, true);
  t.deepEqual(files[0], { filePath: "tests/snapshots/bind-this/input.svelte", moduleName: "input" });
  t.end();
});
