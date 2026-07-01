import type { ComponentProp, ComponentSlot, ParsedComponent } from "./ComponentParser";

/**
 * One `@example` block worth type-checking, reduced to what `resolve-types.ts`
 * needs: a declaration for the documented symbol and the example body itself.
 */
export interface ExampleCheckSource {
  /** Stable id for diagnostics, e.g. `"prop:variant"` or `"prop:variant#1"` for a second example. */
  id: string;
  /** Human-readable name shown in diagnostics, e.g. `"variant"` or `"variant (example 2)"`. */
  name: string;
  /** TypeScript type to bind the documented symbol to before running `code`. */
  type: string;
  /** The `@example` body, stripped of any surrounding code fence. */
  code: string;
}

const FENCE_REGEX = /^```([\w-]*)\r?\n([\s\S]*?)\r?\n?```$/;

/** Languages sveld can type-check with `tsc`. Anything else (svelte, html, ...) is markup and skipped. */
const CHECKABLE_FENCE_LANGS = new Set(["", "js", "jsx", "ts", "tsx", "javascript", "typescript"]);

/**
 * Extracts plain TS/JS code from an `@example` body, or `null` when the
 * example is Svelte/HTML markup (or another language sveld can't type-check
 * without `svelte2tsx` or similar).
 */
function extractCheckableCode(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed === "") return null;

  const fenceMatch = trimmed.match(FENCE_REGEX);
  if (fenceMatch) {
    const lang = fenceMatch[1].toLowerCase();
    if (!CHECKABLE_FENCE_LANGS.has(lang)) return null;
    const inner = fenceMatch[2].trim();
    return inner === "" ? null : inner;
  }

  // No fence: skip bare markup like `<Disclosure open />`.
  if (trimmed.startsWith("<")) return null;
  return trimmed;
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
): ExampleCheckSource[] {
  const examples = (tags ?? []).filter((tag) => tag.name === "example");
  const sources: ExampleCheckSource[] = [];

  examples.forEach((tag, index) => {
    const code = extractCheckableCode(tag.body);
    if (code === null) return;
    const numbered = examples.length > 1;
    sources.push({
      id: numbered ? `${idPrefix}#${index}` : idPrefix,
      name: numbered ? `${name} (example ${index + 1})` : name,
      type,
      code,
    });
  });

  return sources;
}

function slotName(slot: ComponentSlot): string {
  return slot.name ?? "default";
}

/**
 * Collects every `@example` block sveld can type-check for a parsed component:
 * plain TS/JS bodies on props, module exports, slots, and events. Svelte/HTML
 * markup examples (most slot/event examples, many prop examples) are skipped.
 * Checking those needs `svelte2tsx` or similar; sveld stays AST-only.
 */
export function collectExampleSources(component: ParsedComponent): ExampleCheckSource[] {
  const sources: ExampleCheckSource[] = [];

  for (const prop of component.props) {
    sources.push(...sourcesFromTags(prop.tags, `prop:${prop.name}`, prop.name, typeForProp(prop)));
  }

  for (const moduleExport of component.moduleExports) {
    sources.push(
      ...sourcesFromTags(
        moduleExport.tags,
        `export:${moduleExport.name}`,
        moduleExport.name,
        typeForProp(moduleExport),
      ),
    );
  }

  for (const slot of component.slots) {
    sources.push(...sourcesFromTags(slot.tags, `slot:${slotName(slot)}`, slotName(slot), "any"));
  }

  for (const event of component.events) {
    sources.push(...sourcesFromTags(event.tags, `event:${event.name}`, event.name, "any"));
  }

  return sources;
}
