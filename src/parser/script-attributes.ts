import type { AST } from "sveast";
import type { ScriptLanguage, SourceRange } from "../model";
import type { ParserContext } from "./context";
import { recordDiagnostic } from "./diagnostics";
import { sourceRangeFromNode } from "./source-position";

function getStaticAttributeValue(attribute: AST.Attribute) {
  if (!Array.isArray(attribute.value)) return undefined;

  return attribute.value
    .map((value) => (value.type === "Text" ? value.data : ""))
    .join("")
    .trim();
}

export function resolveScriptLanguage(parsed: {
  instance?: AST.Script;
  module?: AST.Script;
}): ScriptLanguage | undefined {
  const scripts = [parsed.instance, parsed.module].filter((script) => script !== undefined);
  let hasPlainScript = false;

  for (const script of scripts) {
    const langAttribute = script.attributes.find((attribute) => attribute.name === "lang");
    if (!langAttribute) {
      hasPlainScript = true;
      continue;
    }

    if (getStaticAttributeValue(langAttribute)?.toLowerCase() === "ts") return "ts";
  }

  return hasPlainScript ? "js" : undefined;
}

/** The instance script's `generics` attribute, which is only valid alongside `lang="ts"`. */
export function resolveScriptGenericsAttribute(
  ctx: ParserContext,
  parsed: { instance?: AST.Script },
): { value: string; source?: SourceRange } | undefined {
  const genericsAttribute = parsed.instance?.attributes.find((attribute) => attribute.name === "generics");
  if (!genericsAttribute) return undefined;

  const source = sourceRangeFromNode(ctx, genericsAttribute);
  const langAttribute = parsed.instance?.attributes.find((attribute) => attribute.name === "lang");
  const language = langAttribute ? getStaticAttributeValue(langAttribute)?.toLowerCase() : undefined;

  if (language !== "ts") {
    recordDiagnostic(
      ctx,
      "syntax-skipped",
      "generics",
      `<script generics="..."> requires lang="ts"; the generics attribute was ignored because the script is not TypeScript.`,
      source,
    );
    return undefined;
  }

  const value = getStaticAttributeValue(genericsAttribute);
  if (!value) return undefined;

  return { value, source };
}
