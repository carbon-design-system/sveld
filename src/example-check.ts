import type { ComponentDocApi, ResolveComponentFilePath } from "./bundle";
import { createDiagnostic, type SveldDiagnostic } from "./diagnostics";
import type { ComponentProp, ParsedComponent, SourceRange } from "./model";
import { loadParserStack } from "./parser-stack";
import type { TypeResolver } from "./resolve-types";

/** `"compile"` runs through the TypeScript program; `"syntax"` runs through sveld's template parser only. */
type ExampleCheckKind = "compile" | "syntax";

export interface ExampleCheckSource {
  /** Stable id for diagnostics, e.g. `"prop:variant"` or `"prop:variant#1"` for a second example. */
  id: string;
  /** Human-readable name shown in diagnostics, e.g. `"variant"` or `"variant (example 2)"`. */
  name: string;
  /** TypeScript type to bind the documented symbol to before running `code`. Unused for `kind: "syntax"`. */
  type: string;
  /** The `@example` body, stripped of any surrounding code fence. */
  code: string;
  kind: ExampleCheckKind;
  /** The documented symbol's range. */
  source?: SourceRange;
}

const FENCE_REGEX = /^```([\w-]*)\r?\n([\s\S]*?)\r?\n?```$/;

const COMPILE_FENCE_LANGS = new Set(["", "js", "jsx", "ts", "tsx", "javascript", "typescript"]);
const SYNTAX_FENCE_LANGS = new Set(["svelte", "html"]);

/** `null` for another fenced language, or bare unfenced markup. */
function extractCheckableCode(body: string): Pick<ExampleCheckSource, "kind" | "code"> | null {
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
  const numbered = examples.length > 1;
  return examples.flatMap((tag, index): ExampleCheckSource[] => {
    const extracted = extractCheckableCode(tag.body);
    if (extracted === null) return [];
    return [
      {
        id: numbered ? `${idPrefix}#${index}` : idPrefix,
        name: numbered ? `${name} (example ${index + 1})` : name,
        type,
        code: extracted.code,
        kind: extracted.kind,
        ...(source ? { source } : {}),
      },
    ];
  });
}

/** The checkable `@example` blocks on a component's props, module exports, slots, and events. */
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
    const name = slot.name ?? "default";
    sources.push(...sourcesFromTags(slot.tags, `slot:${name}`, name, "any", slot.source));
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

/** Drops candidates left with no sources of `kind`. */
function candidatesForKind(candidates: CheckExamplesCandidate[], kind: ExampleCheckKind): CheckExamplesCandidate[] {
  return candidates.flatMap(({ component, sources }) => {
    const matching = sources.filter((source) => source.kind === kind);
    return matching.length === 0 ? [] : [{ component, sources: matching }];
  });
}
async function checkComponentExamplesSyntax(
  candidates: CheckExamplesCandidate[],
): Promise<Map<ComponentDocApi, SveldDiagnostic[]>> {
  const { formatParseError, parseSvelte } = await loadParserStack();
  const found = new Map<ComponentDocApi, SveldDiagnostic[]>();
  for (const { component, sources } of candidates) {
    const diagnostics: SveldDiagnostic[] = [];

    for (const source of sources) {
      try {
        parseSvelte(source.code);
      } catch (error) {
        diagnostics.push(
          createDiagnostic({
            component: component.filePath,
            kind: "example-syntax-error",
            name: source.name,
            message: formatParseError(error),
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

/** Each component's `example-syntax-error` diagnostics, then its `example-compile-error` ones. */
export async function checkComponentExamples(
  components: Iterable<ComponentDocApi>,
  mode: true | "syntax",
  rootDir: string,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<Map<ComponentDocApi, SveldDiagnostic[]>> {
  const candidates = Array.from(components, (component) => ({ component, sources: collectExampleSources(component) }));
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
    // Only loaded when there's TS/JS to compile.
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
