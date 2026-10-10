/**
 * Checks that each prop type sveld infers holds for its own component: the
 * type is written back into a copy of the source as `@type` (or a TS
 * annotation) on each `export let`, or on the whole `$props()` destructure,
 * and svelte-check runs over the copies and the originals. A new
 * error at the prop's default, a `bind:this`, or a `prop = value` is a finding.
 * Other new errors only mean the component's own reads got stricter.
 *
 * Covers `tests/fixtures` and the carbon e2e project, from their committed
 * snapshots, with the svelte-check `bun run test:e2e` installs. Exits non-zero
 * on any finding.
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
import { escapeRegExp } from "../src/parser/utils";

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
const PROPS_CALL_REGEX = /=\s*\$props\(\)/;
const RENAMED_BINDING_REGEX = /([\w$]+)\s*:\s*([\w$]+)/g;
/** `let ` (with any JSDoc right before it) ending where a destructure starts. */
const LET_BEFORE_REGEX = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?((?:let|const)\s*)$/;
/** svelte-check's HTML type for an element sveld (rightly) puts in the SVG or MathML namespace. */
const NAMESPACE_BLIND_ELEMENT_REGEX =
  /^Type 'HTML\w*Element' is (?:missing the following properties from|not assignable to) type '(?:SVG|MathML)\w*Element'/;

interface Prop {
  name: string;
  kind: string;
  type?: string;
  typeSource?: string;
  isRequired?: boolean;
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

const isInferred = (prop: Prop) => prop.type !== undefined && INFERRED_TYPE_SOURCES.has(prop.typeSource ?? "");

/**
 * An untyped `let { ... } = $props()` typed as an object of every prop, or
 * `undefined` when there's none (or it's already typed).
 */
function annotateRunesProps(
  source: string,
  props: Prop[],
  isTs: boolean,
): { text: string; destructure: string } | undefined {
  const call = source.search(PROPS_CALL_REGEX);
  if (call === -1) return undefined;
  // Walk back from the destructure's closing `}` to its opening `{`.
  let close = call;
  while (close > 0 && source[close] !== "}") close--;
  if (source.slice(close + 1, call).trim() !== "") return undefined;
  let depth = 0;
  let open = close;
  for (; open >= 0; open--) {
    if (source[open] === "}") depth++;
    else if (source[open] === "{" && --depth === 0) break;
  }
  const declaration = source.slice(0, open).match(LET_BEFORE_REGEX);
  if (!declaration || declaration[1]?.includes("@type")) return undefined;

  const members = props.map(
    (prop) => `${JSON.stringify(prop.name)}${prop.isRequired ? "" : "?"}: ${prop.type ?? "any"}`,
  );
  if (source.slice(open, close).includes("...")) members.push("[key: string]: any");
  const type = `{ ${members.join("; ")} }`;
  const letStart = open - declaration[2].length;
  const text = isTs
    ? `${source.slice(0, close + 1)}: ${type} ${source.slice(close + 1)}`
    : `${source.slice(0, letStart)}/** @type {${type}} */ ${source.slice(letStart)}`;
  return { text, destructure: source.slice(open, close + 1) };
}

/** The source with each inferred prop type written in, and the names annotated. */
function annotate({ source, props }: Component): { text: string; names: Set<string> } {
  const isTs = SCRIPT_LANG_TS_REGEX.test(source);
  const names = new Set<string>();
  const runes = annotateRunesProps(source, props, isTs);
  if (runes !== undefined) {
    // A renamed prop (`count: initialCount = 0`) is reported at its local name.
    const localNames = new Map(
      [...runes.destructure.matchAll(RENAMED_BINDING_REGEX)].map(([, from, to]) => [from, to]),
    );
    for (const prop of props.filter(isInferred)) names.add(localNames.get(prop.name) ?? prop.name);
    return { text: runes.text, names };
  }
  let text = source;
  for (const prop of props) {
    if (prop.kind !== "let" || !isInferred(prop)) continue;
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
    if (isBinding && NAMESPACE_BLIND_ELEMENT_REGEX.test(message)) continue;

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
