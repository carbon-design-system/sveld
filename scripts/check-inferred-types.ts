/**
 * Checks that the prop types sveld infers hold for the component they came
 * from. Each inferred `export let` type (from a default value or a
 * `bind:this`) is written back into a copy of the source as `@type` (or a TS
 * annotation), and svelte-check runs over the copies and the originals. A
 * new error where a value flows into an annotated prop, at its default, a
 * `bind:this`, or a plain `prop = value`, means sveld's type rejects a value
 * the component itself gives the prop.
 *
 * Errors elsewhere are ignored: an annotation also makes the component's own
 * reads stricter (`'ref' is possibly 'null'`), which says nothing about the
 * type sveld emits.
 *
 * Runs over `tests/fixtures` and the carbon e2e project, using the
 * snapshots they commit (`output.json`, `COMPONENT_API.json`), and the
 * svelte-check installed for the carbon e2e project.
 *
 * Usage:
 *   bun run test:inferred-types   (after `bun run test:e2e` has installed it)
 *
 * Exits non-zero on any finding.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { $ } from "bun";

const ROOT = path.join(import.meta.dir, "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures");
const CARBON_DIR = path.join(ROOT, "tests", "e2e", "carbon");
const NODE_MODULES = path.join(CARBON_DIR, "node_modules");
const SVELTE_CHECK = path.join(NODE_MODULES, ".bin", "svelte-check");

/** `typeSource`s sveld inferred, rather than read off JSDoc or a TS annotation. */
const INFERRED_TYPE_SOURCES = new Set(["default", "inferred"]);

const TSCONFIG = {
  compilerOptions: {
    strict: true,
    allowJs: true,
    checkJs: true,
    module: "ESNext",
    moduleResolution: "bundler",
    target: "ESNext",
    noEmit: true,
    skipLibCheck: true,
  },
  include: ["**/*.svelte"],
};

const SCRIPT_LANG_TS_REGEX = /<script[^>]*\blang=["']ts["']/;
const MACHINE_ERROR_REGEX = /^\d+ ERROR "([^"]+)" (\d+):(\d+) "(.*)"$/;
const IDENTIFIER_REGEX = /^[\w$]+/;
const BIND_THIS_BEFORE_REGEX = /bind:this=\{?\s*$/;
const ASSIGNMENT_AFTER_REGEX = /^\s*=(?!=)/;

interface Prop {
  name: string;
  kind: string;
  type?: string;
  typeSource?: string;
}

interface Component {
  /** Path in the workspace, relative to its root. */
  file: string;
  source: string;
  props: Prop[];
}

interface Workspace {
  name: string;
  components: Component[];
  /** Copied into both variants first, for imports between components. */
  copyFrom?: string;
}

interface Finding {
  workspace: string;
  location: string;
  message: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The source with each inferred prop type written in, and the names annotated. */
function annotate({ source, props }: Component): { text: string; names: Set<string> } {
  const isTs = SCRIPT_LANG_TS_REGEX.test(source);
  const names = new Set<string>();
  let text = source;
  for (const prop of props) {
    if (prop.kind !== "let" || !prop.type || !INFERRED_TYPE_SOURCES.has(prop.typeSource ?? "")) continue;
    // A lone, unannotated declarator: `export let name = ...`, `export let name;`.
    const declaration = new RegExp(`export let ${escapeRegExp(prop.name)}\\b(?!\\s*:)(?=\\s*[=;\\n])`);
    if (!declaration.test(text)) continue;
    text = text.replace(
      declaration,
      isTs ? `export let ${prop.name}: ${prop.type}` : `/** @type {${prop.type}} */ export let ${prop.name}`,
    );
    names.add(prop.name);
  }
  return { text, names };
}

async function svelteCheckErrors(dir: string): Promise<string[]> {
  const result = await $`${SVELTE_CHECK} --workspace ${dir} --output machine`.nothrow().quiet();
  return result.stdout
    .toString()
    .split("\n")
    .filter((line) => MACHINE_ERROR_REGEX.test(line));
}

async function checkWorkspace(root: string, workspace: Workspace): Promise<Finding[]> {
  const dirs = {
    baseline: path.join(root, workspace.name, "baseline"),
    annotated: path.join(root, workspace.name, "annotated"),
  };
  const annotatedNames = new Map<string, Set<string>>();
  const annotatedLines = new Map<string, string[]>();

  for (const dir of Object.values(dirs)) {
    mkdirSync(dir, { recursive: true });
    if (workspace.copyFrom) cpSync(workspace.copyFrom, dir, { recursive: true });
    symlinkSync(NODE_MODULES, path.join(dir, "node_modules"));
    writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(TSCONFIG));
  }
  await Promise.all(
    workspace.components.map(async (component) => {
      const { text, names } = annotate(component);
      annotatedNames.set(component.file, names);
      annotatedLines.set(component.file, text.split("\n"));
      await Bun.write(path.join(dirs.baseline, component.file), component.source);
      await Bun.write(path.join(dirs.annotated, component.file), text);
    }),
  );

  const [baseline, annotated] = await Promise.all([
    svelteCheckErrors(dirs.baseline),
    svelteCheckErrors(dirs.annotated),
  ]);
  // Annotations only insert text within a line, so file and line identify an error across both.
  const key = (line: string) => {
    const [, file, lineNumber, , message] = line.match(MACHINE_ERROR_REGEX) ?? [];
    return `${file}:${lineNumber} ${message}`;
  };
  const baselineKeys = new Set(baseline.map(key));

  const findings: Finding[] = [];
  for (const line of annotated) {
    if (baselineKeys.has(key(line))) continue;
    const [, file, lineNumber, column, message] = line.match(MACHINE_ERROR_REGEX) ?? [];

    const text = annotatedLines.get(file)?.[Number(lineNumber) - 1] ?? "";
    const before = text.slice(0, Number(column) - 1);
    const target = text.slice(Number(column) - 1).match(IDENTIFIER_REGEX)?.[0];
    if (!target || !annotatedNames.get(file)?.has(target)) continue;
    const after = text.slice(Number(column) - 1 + target.length);
    const isDefault = before.endsWith("export let ");
    const isBinding = BIND_THIS_BEFORE_REGEX.test(before);
    const isAssignment = ASSIGNMENT_AFTER_REGEX.test(after);
    if (!isDefault && !isBinding && !isAssignment) continue;

    findings.push({
      workspace: workspace.name,
      location: `${file}:${lineNumber}:${column}`,
      message: message.replaceAll('\\"', '"').replaceAll("\\n", "\n"),
    });
  }
  return findings;
}

async function fixturesWorkspace(): Promise<Workspace> {
  const components = await Promise.all(
    readdirSync(FIXTURES_DIR)
      .filter((name) => existsSync(path.join(FIXTURES_DIR, name, "output.json")))
      .map(async (name) => ({
        file: `${name}.svelte`,
        source: await Bun.file(path.join(FIXTURES_DIR, name, "input.svelte")).text(),
        props: ((await Bun.file(path.join(FIXTURES_DIR, name, "output.json")).json()).props ?? []) as Prop[],
      })),
  );
  return { name: "fixtures", components };
}

async function carbonWorkspace(): Promise<Workspace> {
  const api = await Bun.file(path.join(CARBON_DIR, "COMPONENT_API.json")).json();
  // A component exported under two names is listed twice; check its file once.
  const propsByFile = new Map<string, Prop[]>();
  for (const { filePath, props } of api.components as Array<{ filePath: string; props: Prop[] }>) {
    if (!propsByFile.has(filePath)) propsByFile.set(filePath, props);
  }
  const components = await Promise.all(
    [...propsByFile].map(async ([file, props]) => ({
      file,
      source: await Bun.file(path.join(CARBON_DIR, file)).text(),
      props,
    })),
  );
  return { name: "carbon", components, copyFrom: path.join(CARBON_DIR, "src") };
}

if (!existsSync(SVELTE_CHECK)) {
  console.error(
    `No svelte-check at ${path.relative(ROOT, SVELTE_CHECK)}. Run \`bun run test:e2e\` first to install it.`,
  );
  process.exit(1);
}

const root = realpathSync(mkdtempSync(path.join(tmpdir(), "sveld-inferred-types-")));
try {
  const workspaces = await Promise.all([fixturesWorkspace(), carbonWorkspace()]);
  const findings = (await Promise.all(workspaces.map((workspace) => checkWorkspace(root, workspace)))).flat();
  const annotated = workspaces.reduce((count, { components }) => count + components.length, 0);

  if (findings.length === 0) {
    console.log(`Inferred prop types hold across ${annotated} components.`);
  } else {
    console.error(`${findings.length} inferred prop type(s) reject a value the component gives the prop:\n`);
    for (const { workspace, location, message } of findings) {
      console.error(`  ${workspace}: ${location}\n    ${message.replaceAll("\n", "\n    ")}`);
    }
    process.exitCode = 1;
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
