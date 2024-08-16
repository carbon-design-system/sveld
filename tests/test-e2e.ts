import { $ } from "bun";
import { name } from "../package.json";

await $`bun link`;

for await (const dir of $`find tests/e2e -maxdepth 1`.lines()) {
  await $`cd ${dir} && rm -rf types`;
  await $`cd ${dir} && bun link ${name}`;
  await $`cd ${dir} && bun install`;
  await $`cd ${dir} && bun run build`;
}
