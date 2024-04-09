import { Glob, $ } from "bun";
import { name } from "../package.json";

await $`bun link`;

const dirs = new Glob("*").scanSync({
  cwd: "tests/e2e",
  onlyFiles: false,
  absolute: true,
});

for await (const dir of dirs) {
  await $`cd ${dir} && rm -rf types`;
  await $`cd ${dir} && bun link ${name}`;
  await $`cd ${dir} && bun install`;
  await $`cd ${dir} && bun run build`;
}
