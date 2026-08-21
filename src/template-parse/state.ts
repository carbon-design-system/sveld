import type { AST } from "svelte/compiler";
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

/**
 * `instance`/`module` are missing, not `null`, until a matching `<script>`
 * is found. `root.js` is always `[]` after a bare `parse()`.
 */
type RootInProgress = Omit<AST.Root, "instance" | "module" | "comments"> & {
  js: unknown[];
  instance?: AST.Script;
  module?: AST.Script;
  /**
   * Kept as `CommentWithLocation` while parsing. Public `AST.JSComment[]` is
   * the same shape, just narrower.
   */
  comments: CommentWithLocation[];
};

/** Cursor plus the open-element stack. */
export class TemplateParserState extends Reader {
  readonly root: RootInProgress;
  readonly stack: StackNode[] = [];
  readonly fragments: Fragment[] = [];
  readonly isTypeScript: boolean;
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
