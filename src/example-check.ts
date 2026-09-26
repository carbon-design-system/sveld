import type { ComponentDocApi, ResolveComponentFilePath } from "./bundle";
import { createDiagnostic, type SveldDiagnostic } from "./diagnostics";
import type { ComponentProp, ComponentSlot, ParsedComponent, SourceRange } from "./model";
import { loadParserStack } from "./parser-stack";
import type { TypeResolver } from "./resolve-types";
import { TemplateParseNotImplementedError } from "./template-parse/not-implemented";

/** `"compile"` runs through the TypeScript program; `"syntax"` runs through sveld's template parser only. */
type ExampleCheckKind = "compile" | "syntax";

/**
 * One `@example` block worth checking, reduced to what `resolve-types.ts`
 * (for `kind: "compile"`) or the template parser (for `kind: "syntax"`) needs.
 */
export interface ExampleCheckSource {
  /** Stable id for diagnostics, e.g. `"prop:variant"` or `"prop:variant#1"` for a second example. */
  id: string;
  /** Human-readable name shown in diagnostics, e.g. `"variant"` or `"variant (example 2)"`. */
  name: string;
  /** TypeScript type to bind the documented symbol to before running `code`. Unused for `kind: "syntax"`. */
  type: string;
  /** The `@example` body, stripped of any surrounding code fence. */
  code: string;
  /** How `code` gets checked. */
  kind: ExampleCheckKind;
  /** Source range of the documented symbol (prop/export/slot/event), when available. */
  source?: SourceRange;
}

const FENCE_REGEX = /^```([\w-]*)\r?\n([\s\S]*?)\r?\n?```$/;

/** Languages sveld can type-check with `tsc`. */
const COMPILE_FENCE_LANGS = new Set(["", "js", "jsx", "ts", "tsx", "javascript", "typescript"]);

/** Languages sveld can syntax-check with its own template parser. */
const SYNTAX_FENCE_LANGS = new Set(["svelte", "html"]);

interface ExtractedExampleCode {
  kind: ExampleCheckKind;
  code: string;
}

/**
 * Extracts checkable code from an `@example` body: plain TS/JS (`kind:
 * "compile"`), Svelte/HTML markup (`kind: "syntax"`), or `null` when the
 * example is fenced as something else, or is bare unfenced markup sveld
 * doesn't try to check.
 */
function extractCheckableCode(body: string): ExtractedExampleCode | null {
  const trimmed = body.trim();
  if (trimmed === "") return null;

  const fenceMatch = trimmed.match(FENCE_REGEX);
  if (fenceMatch) {
    const lang = fenceMatch[1].toLowerCase();
    const inner = fenceMatch[2].trim();
    if (inner === "") return null;
    if (COMPILE_FENCE_LANGS.has(lang)) return { kind: "compile", code: inner };
    if (SYNTAX_FENCE_LANGS.has(lang)) return { kind: "syntax", code: inner };
    return null;
  }

  // No fence: skip bare markup like `<Disclosure open />`.
  if (trimmed.startsWith("<")) return null;
  return { kind: "compile", code: trimmed };
}

/** The type sveld declares the documented symbol as before running its examples. */
function typeForProp(prop: ComponentProp): string {
  if (!prop.isFunction) return "any";
  const params = (prop.params ?? []).map((param) => `${param.name}${param.optional ? "?" : ""}: any`).join(", ");
  return `(${params}) => any`;
}

function sourcesFromTags(
  tags: Array<{ name: string; body: string }> | undefined,
  idPrefix: string,
  name: string,
  type: string,
  source: SourceRange | undefined,
): ExampleCheckSource[] {
  const examples = (tags ?? []).filter((tag) => tag.name === "example");
  const sources: ExampleCheckSource[] = [];

  examples.forEach((tag, index) => {
    const extracted = extractCheckableCode(tag.body);
    if (extracted === null) return;
    const numbered = examples.length > 1;
    sources.push({
      id: numbered ? `${idPrefix}#${index}` : idPrefix,
      name: numbered ? `${name} (example ${index + 1})` : name,
      type,
      code: extracted.code,
      kind: extracted.kind,
      ...(source ? { source } : {}),
    });
  });

  return sources;
}

function slotName(slot: ComponentSlot): string {
  return slot.name ?? "default";
}

/**
 * Collects every `@example` block sveld can check for a parsed component:
 * plain TS/JS bodies (`kind: "compile"`) on props, module exports, slots, and
 * events, plus Svelte/HTML markup bodies (`kind: "syntax"`). Bare unfenced
 * markup and other fenced languages are skipped.
 */
export function collectExampleSources(component: ParsedComponent): ExampleCheckSource[] {
  const sources: ExampleCheckSource[] = [];

  for (const prop of component.props) {
    sources.push(...sourcesFromTags(prop.tags, `prop:${prop.name}`, prop.name, typeForProp(prop), prop.source));
  }

  for (const moduleExport of component.moduleExports) {
    sources.push(
      ...sourcesFromTags(
        moduleExport.tags,
        `export:${moduleExport.name}`,
        moduleExport.name,
        typeForProp(moduleExport),
        moduleExport.source,
      ),
    );
  }

  for (const slot of component.slots) {
    sources.push(...sourcesFromTags(slot.tags, `slot:${slotName(slot)}`, slotName(slot), "any", slot.source));
  }

  for (const event of component.events) {
    sources.push(...sourcesFromTags(event.tags, `event:${event.name}`, event.name, "any", event.source));
  }

  return sources;
}

interface CheckExamplesCandidate {
  component: ComponentDocApi;
  sources: ExampleCheckSource[];
}

function collectCheckExamplesCandidates(components: Iterable<ComponentDocApi>): CheckExamplesCandidate[] {
  const candidates: CheckExamplesCandidate[] = [];

  for (const component of components) {
    const sources = collectExampleSources(component);
    if (sources.length === 0) continue;
    candidates.push({ component, sources });
  }

  return candidates;
}

/** Narrows each candidate's `sources` to one `ExampleCheckKind`, dropping candidates left with none. */
function candidatesForKind(
  candidates: CheckExamplesCandidate[],
  kind: ExampleCheckSource["kind"],
): CheckExamplesCandidate[] {
  const filtered: CheckExamplesCandidate[] = [];

  for (const { component, sources } of candidates) {
    const matching = sources.filter((source) => source.kind === kind);
    if (matching.length === 0) continue;
    filtered.push({ component, sources: matching });
  }

  return filtered;
}

/**
 * Syntax-checks `kind: "syntax"` `@example` blocks (Svelte/HTML markup) with
 * sveld's own template parser: parse only, discard the AST. A parser error
 * becomes an `example-syntax-error` diagnostic; a construct the parser
 * doesn't model yet ({@link TemplateParseNotImplementedError}) is not the
 * example's fault, so it's skipped rather than reported.
 */
async function checkComponentExamplesSyntax(
  candidates: CheckExamplesCandidate[],
): Promise<Map<ComponentDocApi, SveldDiagnostic[]>> {
  const { parseSvelte } = await loadParserStack();
  const found = new Map<ComponentDocApi, SveldDiagnostic[]>();
  for (const { component, sources } of candidates) {
    const diagnostics: SveldDiagnostic[] = [];

    for (const source of sources) {
      try {
        parseSvelte(source.code);
      } catch (error) {
        if (error instanceof TemplateParseNotImplementedError) continue;
        diagnostics.push(
          createDiagnostic({
            component: component.filePath,
            kind: "example-syntax-error",
            name: source.name,
            message: error instanceof Error ? error.message : String(error),
            ...(source.source ? { source: source.source } : {}),
          }),
        );
      }
    }

    found.set(component, diagnostics);
  }
  return found;
}

async function compileExamples(
  candidates: CheckExamplesCandidate[],
  resolver: TypeResolver,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<Map<ComponentDocApi, SveldDiagnostic[]>> {
  // Keyed by resolved filePath, not moduleName: two components discovered via
  // `--glob` can share a basename, and moduleName alone isn't unique.
  const diagnosticsByFilePath = await resolver.checkExamples(
    candidates.map(({ component, sources }) => ({
      moduleName: component.moduleName,
      filePath: resolveComponentFilePath(component.filePath),
      sources,
    })),
  );

  const found = new Map<ComponentDocApi, SveldDiagnostic[]>();
  for (const { component, sources } of candidates) {
    const items = diagnosticsByFilePath.get(resolveComponentFilePath(component.filePath));
    if (!items || items.length === 0) continue;

    const sourceById = new Map(sources.map((source) => [source.id, source.source]));
    found.set(
      component,
      items.map((item) => {
        const source = sourceById.get(item.id);
        return createDiagnostic({
          component: component.filePath,
          kind: "example-compile-error",
          name: item.name,
          message: item.message,
          ...(source ? { source } : {}),
        });
      }),
    );
  }
  return found;
}

/**
 * Checks the `@example` blocks of `components` (see `checkExamples` in
 * `GenerateBundleOptions`), returning each one's `example-syntax-error`
 * diagnostics followed by its `example-compile-error` ones. `"syntax"` only
 * runs the template-parser path, so plain TS/JS examples never reach the
 * TypeScript program.
 */
export async function checkComponentExamples(
  components: Iterable<ComponentDocApi>,
  mode: true | "syntax",
  rootDir: string,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<Map<ComponentDocApi, SveldDiagnostic[]>> {
  const candidates = collectCheckExamplesCandidates(components);
  const compileCandidates = mode === true ? candidatesForKind(candidates, "compile") : [];
  const syntaxCandidates = candidatesForKind(candidates, "syntax");

  const found = new Map<ComponentDocApi, SveldDiagnostic[]>();
  const add = (diagnosticsByComponent: Map<ComponentDocApi, SveldDiagnostic[]>) => {
    for (const [component, diagnostics] of diagnosticsByComponent) {
      found.set(component, [...(found.get(component) ?? []), ...diagnostics]);
    }
  };

  if (syntaxCandidates.length > 0) {
    add(await checkComponentExamplesSyntax(syntaxCandidates));
  }

  if (compileCandidates.length > 0) {
    // Guarded on `compileCandidates` (not `candidates`) so `checkExamples:
    // true`/`"syntax"` with only markup fences never loads TypeScript.
    const { TypeResolver } = await import("./resolve-types");
    const created = await TypeResolver.create(rootDir);
    if (!created.ok) throw new Error(`sveld: \`checkExamples\` ${created.message}.`);
    const resolver = created.resolver;

    try {
      add(await compileExamples(compileCandidates, resolver, resolveComponentFilePath));
    } finally {
      await resolver.dispose();
    }
  }

  return found;
}
