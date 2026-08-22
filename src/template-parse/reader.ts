// @ts-expect-error acorn's published types don't declare these. svelte's
// phases/1-parse/index.js imports them the same way.
import { isIdentifierChar, isIdentifierStart } from "acorn";
import type { AST } from "svelte/compiler";

/** Any node being built during a parse. Always has offsets. End may still be unset. */
export interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export function isWhitespace(code: number): boolean {
  if (code === 32 || (code <= 13 && code >= 9)) return true;
  if (code < 160) return false;
  return (
    code === 160 ||
    code === 5760 ||
    (code >= 8192 && code <= 8202) ||
    code === 8232 ||
    code === 8233 ||
    code === 8239 ||
    code === 8287 ||
    code === 12288 ||
    code === 65279
  );
}

/**
 * Source cursor. Same methods as svelte's `Parser` (`phases/1-parse/index.js`).
 * Loose-mode error recovery is not implemented.
 */
export class Reader {
  readonly source: string;
  index = 0;

  constructor(source: string) {
    this.source = source;
  }

  match(str: string): boolean {
    // charCodeAt comparison avoids materializing a one-char string.
    if (str.length === 1) return this.source.charCodeAt(this.index) === str.charCodeAt(0);
    return this.source.startsWith(str, this.index);
  }

  matchRegex(pattern: RegExp): string | null {
    pattern.lastIndex = this.index;
    const match = pattern.exec(this.source);
    if (!match || match.index !== this.index) return null;
    return match[0];
  }

  eat(str: string, required = false): boolean {
    if (this.match(str)) {
      this.index += str.length;
      return true;
    }
    if (required) {
      throw new TemplateSyntaxError(`Expected token ${JSON.stringify(str)}`, this.index);
    }
    return false;
  }

  read(pattern: RegExp): string | null {
    const result = this.matchRegex(pattern);
    if (result) this.index += result.length;
    return result;
  }

  /** `pattern` needs the `g` flag. `lastIndex` resumes in place so we don't `slice()` the source on every tag. */
  readUntil(pattern: RegExp): string {
    if (this.index >= this.source.length) {
      throw new TemplateSyntaxError("Unexpected end of input", this.source.length);
    }
    const start = this.index;
    pattern.lastIndex = start;
    const match = pattern.exec(this.source);
    if (match) {
      this.index = match.index;
      return this.source.slice(start, this.index);
    }
    this.index = this.source.length;
    return this.source.slice(start);
  }

  /** `readUntil` for a fixed string: `indexOf` instead of regex `exec`, no match allocation. */
  readUntilString(needle: string): string {
    if (this.index >= this.source.length) {
      throw new TemplateSyntaxError("Unexpected end of input", this.source.length);
    }
    const found = this.source.indexOf(needle, this.index);
    const end = found === -1 ? this.source.length : found;
    const result = this.source.slice(this.index, end);
    this.index = end;
    return result;
  }

  allowWhitespace(): void {
    while (this.index < this.source.length && isWhitespace(this.source.charCodeAt(this.index))) {
      this.index++;
    }
  }

  requireWhitespace(): void {
    if (!isWhitespace(this.source.charCodeAt(this.index))) {
      throw new TemplateSyntaxError("Expected whitespace", this.index);
    }
    this.allowWhitespace();
  }

  /**
   * From svelte's `read_identifier`. The result is an estree `Identifier`
   * because svelte uses this object as an `ExpressionTag.expression` for
   * attribute shorthand.
   */
  readIdentifierName(): { type: "Identifier"; name: string; start: number; end: number } {
    const start = this.index;
    let end = start;
    let name = "";

    const code = this.source.codePointAt(this.index);
    if (code !== undefined && isIdentifierStart(code, true)) {
      end += code <= 0xffff ? 1 : 2;
      while (end < this.source.length) {
        const next = this.source.codePointAt(end);
        if (next === undefined || !isIdentifierChar(next, true)) break;
        end += next <= 0xffff ? 1 : 2;
      }
      name = this.source.slice(start, end);
      this.index = end;
    }

    return { type: "Identifier", name, start, end };
  }
}

export class TemplateSyntaxError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(`${message} (at index ${position})`);
    this.name = "TemplateSyntaxError";
    this.position = position;
  }
}

export type Fragment = AST.Fragment;

export function createFragment(): Fragment {
  return { type: "Fragment", nodes: [] };
}
