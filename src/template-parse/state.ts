import type { Program } from "estree";
import type { AST } from "svelte/compiler";
import type { LineTable } from "./acorn-bridge";
import type { CommentWithLocation } from "./comments";
import { createFragment, type Fragment, Reader } from "./reader";

const REGEX_LANG_TS_ATTRIBUTE =
  /<script\s+(?:[^>]*|(?:[^=>'"/]+=(?:"[^"]*"|'[^']*'|[^>\s]+)\s+)*)lang=(["'])?ts\1[^>]*>/;

/** Node on the open-element stack. Has its own fragment. */
export interface StackNode {
  type: string;
  name?: string;
  fragment: Fragment;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** estree's `Program`, plus the `start`/`end` offsets acorn sets on every node. */
export type ScriptProgram = Program & { start: number; end: number };

/** svelte's `AST.Script`, with its `content`'s offsets typed. */
export type TemplateScript = AST.Script & { content: ScriptProgram };

/**
 * What `parse()` returns: svelte's `AST.Root` (`parse(source, { modern: true })`)
 * with these differences.
 *
 * - `instance`/`module` are missing, not `null`, when there's no such
 *   `<script>`. svelte's own modern AST does the same, despite its types.
 * - `comments` are {@link CommentWithLocation}s: `AST.JSComment` without `loc`.
 * - `js` is svelte's legacy root field, always `[]` after a bare `parse()`.
 * - Fields sveld never reads are left out even where svelte's node types
 *   require them: `name_loc`, expression `.loc`, directive `modifiers`,
 *   `TransitionDirective.intro`/`.outro`, `SnippetBlock.parameters`/
 *   `.typeParams`, and `trailingComments`. Body `Text.data` is the raw text,
 *   not entity-decoded, and `StyleSheet` has no parsed CSS.
 *   `tests/svelte-template-parse-shim.test.ts` drops the same fields before
 *   comparing against svelte.
 *
 * A `lang="ts"` script's `content` is typed as estree's `Program`, but also
 * holds the TS nodes and fields acorn-typescript adds (`TSInterfaceDeclaration`,
 * `typeAnnotation`, `importKind`, ...), which estree's types don't name.
 */
export type TemplateRoot = Omit<AST.Root, "instance" | "module" | "comments"> & {
  js: unknown[];
  instance?: TemplateScript;
  module?: TemplateScript;
  comments: CommentWithLocation[];
};

/**
 * A node in {@link TemplateRoot}'s tree: svelte's `AST.SvelteNode` (template,
 * CSS, and estree nodes). The acorn-typescript nodes under a `lang="ts"`
 * script (`TSTypeAnnotation`, `TSInterfaceDeclaration`, ...) are in the tree
 * too but not in the union, so checking `type` never narrows to one.
 */
export type TemplateAstNode = AST.SvelteNode;

/** Cursor plus the open-element stack. */
export class TemplateParserState extends Reader {
  readonly root: TemplateRoot;
  readonly stack: StackNode[] = [];
  readonly fragments: Fragment[] = [];
  readonly isTypeScript: boolean;
  /** Line-break offsets of `source`, filled in by the first TS expression parse that needs them. */
  readonly lineTable: LineTable = {};
  /** Last auto-closed tag, e.g. `<li>` before another `<li>`. A later stray closer for it is ignored. */
  lastAutoClosedTag?: { tag: string; reason: string; depth: number };

  /**
   * `originalLength` is the untrimmed source length. svelte trims trailing
   * whitespace so a trailing newline isn't a Text node, then sets `Root.end`
   * to the untrimmed length anyway. Caller must pass already-trimmed `source`.
   */
  constructor(source: string, originalLength: number) {
    super(source);
    this.isTypeScript = REGEX_LANG_TS_ATTRIBUTE.test(source);

    const fragment = createFragment();
    this.root = {
      type: "Root",
      start: 0,
      end: originalLength,
      css: null,
      js: [],
      options: null,
      fragment,
      comments: [],
    };

    this.stack.push(this.root as unknown as StackNode);
    this.fragments.push(fragment);
  }

  current(): StackNode {
    return this.stack[this.stack.length - 1];
  }

  currentFragment(): Fragment {
    return this.fragments[this.fragments.length - 1];
  }

  push(node: StackNode, fragment: Fragment): void {
    this.stack.push(node);
    this.fragments.push(fragment);
  }

  pop(): StackNode | undefined {
    this.fragments.pop();
    return this.stack.pop();
  }

  append<T extends AST.Fragment["nodes"][number]>(node: T): T {
    this.currentFragment().nodes.push(node);
    return node;
  }
}
