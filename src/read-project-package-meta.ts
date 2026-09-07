import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePackageJson } from "./validate";

/** `name`/`description` from the consuming project's `package.json`, or `{}` if it can't be read. */
export function readProjectPackageMeta(): Pick<ReturnType<typeof parsePackageJson>, "name" | "description"> {
  try {
    const { name, description } = parsePackageJson(
      JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")),
    );
    return { name, description };
  } catch {
    return {};
  }
}
