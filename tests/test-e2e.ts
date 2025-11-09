import { $ } from "bun";
import { name } from "../package.json";

await $`bun link`;

let hasError = false;

for await (const dir of $`find tests/e2e -maxdepth 1`.lines()) {
  try {
    await $`cd ${dir} && rm -rf types`;
    await $`cd ${dir} && bun link ${name}`;
    await $`cd ${dir} && bun install`;

    const result = await $`cd ${dir} && bun run build`;

    if (result.exitCode !== 0) {
      console.error(`Build failed in ${dir}`);
      hasError = true;
    }
  } catch (error) {
    console.error(`Error in ${dir}:`, error);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}
