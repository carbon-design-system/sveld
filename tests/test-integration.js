const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { exec: child_process_exec } = require("child_process");
const { promisify } = require("util");
const exec = promisify(child_process_exec);
const { name } = require("../package.json");

const dirs = fs
  .readdirSync("integration")
  .map((i) => path.join("integration", i))
  .filter((i) => fs.lstatSync(i).isDirectory());

const execCwd = async (dir, ...args) => await exec(`yarn --cwd ${dir} ${args}`);

(async () => {
  try {
    await exec("yarn link");

    for await (const dir of dirs) {
      const typesDir = path.join(dir, "types");

      if (fs.existsSync(typesDir)) {
        fs.rmSync(typesDir, { recursive: true, force: true });
      }

      await execCwd(dir, `link "${name}"`);
      await execCwd(dir, "install");

      const build = await execCwd(dir, "build");
      console.log(build.stdout + "\n");

      const svelteCheck = await execCwd(dir, "svelte-check");
      console.log(svelteCheck.stdout + "\n");
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
