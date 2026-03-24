declare module "@rollup/plugin-node-resolve";

/**
 * Ambient typings for `comment-parser`. The package ships `.d.ts` under `lib/`, but with
 * `moduleResolution: "bundler"` TypeScript 6 resolves the entry to `lib/index.cjs` and does
 * not apply those types (TS7016). Declaring the module here keeps `tsc` strict without
 * path mappings that would break Bun's bundler when it follows the same resolution.
 */
declare module "comment-parser" {
  export interface BlockMarkers {
    start: string;
    nostart: string;
    delim: string;
    end: string;
  }
  export interface Tokens {
    start: string;
    delimiter: string;
    postDelimiter: string;
    tag: string;
    postTag: string;
    name: string;
    postName: string;
    type: string;
    postType: string;
    description: string;
    end: string;
    lineEnd: string;
  }
  export interface Line {
    number: number;
    source: string;
    tokens: Tokens;
  }
  export interface Problem {
    code:
      | "unhandled"
      | "custom"
      | "source:startline"
      | "spec:tag:prefix"
      | "spec:type:unpaired-curlies"
      | "spec:name:unpaired-brackets"
      | "spec:name:empty-name"
      | "spec:name:invalid-default"
      | "spec:name:empty-default";
    message: string;
    line: number;
    critical: boolean;
  }
  export interface Spec {
    tag: string;
    name: string;
    default?: string;
    type: string;
    optional: boolean;
    description: string;
    problems: Problem[];
    source: Line[];
  }
  export interface Block {
    description: string;
    tags: Spec[];
    source: Line[];
    problems: Problem[];
  }
  export interface ParserOptions {
    startLine: number;
    fence: string;
    spacing: "compact" | "preserve";
    markers: BlockMarkers;
    tokenizers: unknown[];
  }
  export function parse(source: string, options?: Partial<ParserOptions>): Block[];
}
