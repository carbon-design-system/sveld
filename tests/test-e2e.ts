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

// Smoke-test the published bin shim: a config file that throws while
// loading must exit non-zero (see cli.js's rejection handler), otherwise
// CI gates using --strict or --check would pass silently on a crash.
const cliPath = `${import.meta.dir}/../cli.js`;
const crashResult = Bun.spawnSync(["node", cliPath], {
  cwd: `${import.meta.dir}/e2e/cli-crash`,
  stdout: "pipe",
  stderr: "pipe",
});
const crashStderr = crashResult.stderr.toString();

if (crashResult.exitCode !== 1 || !crashStderr.includes("sveld.config.js")) {
  console.error("CLI crash smoke test failed. exitCode:", crashResult.exitCode, "stderr:", crashStderr);
  hasError = true;
}

if (hasError) {
  process.exit(1);
}
