import type { AST } from "svelte/compiler";
import { parseProgram } from "./acorn-bridge";
import type { TemplateParserState } from "./state";

// `g` flag required: `readUntil()` drives this via `lastIndex`.
const REGEX_CLOSING_SCRIPT_TAG = /<\/script\s*>/g;
const REGEX_STARTS_WITH_CLOSING_SCRIPT_TAG = /<\/script\s*>/y;
const REGEX_NOT_NEWLINE = /[^\n]/g;

const RESERVED_ATTRIBUTES = new Set(["server", "client", "worker", "test", "default"]);

/**
 * From svelte's `phases/1-parse/read/script.js`. The template is parsed whole,
 * padded with spaces, so acorn's `start`/`end` land on real offsets without a
 * second pass to shift them.
 */
export function readScript(state: TemplateParserState, start: number, attributes: AST.Attribute[]): AST.Script {
  const scriptStart = state.index;
  const data = state.readUntil(REGEX_CLOSING_SCRIPT_TAG);
  if (state.index >= state.source.length) {
    throw new Error("sveld: unclosed <script> tag");
  }

  const padded = state.source.slice(0, scriptStart).replace(REGEX_NOT_NEWLINE, " ") + data;
  state.read(REGEX_STARTS_WITH_CLOSING_SCRIPT_TAG);

  const program = parseProgram(padded, state.isTypeScript, state.root.comments) as unknown as { start: number };
  // Acorn numbers a `Program` from 0. Pin `.start` to the real `<script>` content offset.
  program.start = scriptStart;

  let context: "default" | "module" = "default";

  for (const attribute of attributes) {
    if (RESERVED_ATTRIBUTES.has(attribute.name)) {
      throw new Error(`sveld: "${attribute.name}" is a reserved <script> attribute name.`);
    }

    if (attribute.name === "module") {
      if (attribute.value !== true) {
        throw new Error("sveld: <script module> does not take a value.");
      }
      context = "module";
    }

    if (attribute.name === "context") {
      const value = attribute.value;
      if (value === true || !Array.isArray(value) || value.length !== 1 || value[0].type !== "Text") {
        throw new Error("sveld: context attribute must be a plain string.");
      }
      if (value[0].data !== "module") {
        throw new Error('sveld: only context="module" is valid.');
      }
      context = "module";
    }
  }

  return {
    type: "Script",
    start,
    end: state.index,
    context,
    content: program as unknown as AST.Script["content"],
    attributes,
  };
}
