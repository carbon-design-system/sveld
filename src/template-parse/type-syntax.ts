/**
 * A small recognizer for the common shapes of JSDoc type text: references
 * with type arguments, literals, unions, intersections, arrays, indexed
 * access, `keyof`, `typeof x`, object and tuple literals, and function
 * types. It runs before acorn-typescript in `isValidTypeText`: a cold run
 * over a JS-only library otherwise spends ~10ms warming up the TypeScript
 * parser just to confirm types like `"sm" | "lg"`.
 *
 * It is one-sided. `true` means the text is certainly one valid type;
 * `false` means "not sure", and the caller falls back to the real parser.
 * Anything outside the grammar below (line breaks, comments, escapes,
 * template literals, conditional or mapped types, generic or constructor
 * signatures, modifiers, reserved words) is "not sure".
 */

/** Words that can't start a type reference or name a parameter. */
const RESERVED_WORDS = new Set([
  "abstract",
  "accessor",
  "arguments",
  "as",
  "asserts",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "get",
  "global",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "intrinsic",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "new",
  "null",
  "of",
  "out",
  "override",
  "package",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "set",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "unique",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/** Keyword types and literal words, accepted only on their own (no `.x`, no `<T>`). */
const STANDALONE_TYPE_WORDS = new Set([
  "any",
  "bigint",
  "boolean",
  "false",
  "never",
  "null",
  "number",
  "object",
  "string",
  "symbol",
  "true",
  "undefined",
  "unknown",
  "void",
]);

/** Property keys that a type member could read as a modifier or signature. */
const MODIFIER_KEYS = new Set(["get", "set", "new", "readonly", "static", "public", "private", "protected"]);

function isIdentifierStart(c: number): boolean {
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c === 36;
}

function isIdentifierPart(c: number): boolean {
  return isIdentifierStart(c) || (c >= 48 && c <= 57);
}

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

class TypeSyntaxRecognizer {
  private pos = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  recognize(): boolean {
    this.skipSpaces();
    if (!this.type()) return false;
    this.skipSpaces();
    return this.pos === this.text.length;
  }

  private skipSpaces() {
    while (this.pos < this.text.length) {
      const c = this.text.charCodeAt(this.pos);
      if (c !== 32 && c !== 9) break;
      this.pos++;
    }
  }

  private peek(): number {
    this.skipSpaces();
    return this.text.charCodeAt(this.pos);
  }

  /** Consumes `char` (after spaces) if it's next. */
  private eat(char: string): boolean {
    if (this.peek() !== char.charCodeAt(0)) return false;
    this.pos++;
    return true;
  }

  /** Reads an ASCII identifier, or returns `undefined` without moving. */
  private identifier(): string | undefined {
    this.skipSpaces();
    const start = this.pos;
    if (!isIdentifierStart(this.text.charCodeAt(start))) return undefined;
    let end = start + 1;
    while (end < this.text.length && isIdentifierPart(this.text.charCodeAt(end))) end++;
    this.pos = end;
    return this.text.slice(start, end);
  }

  /** A `"..."` or `'...'` literal without escapes or line breaks. */
  private stringLiteral(): boolean {
    const quote = this.peek();
    if (quote !== 34 && quote !== 39) return false;
    for (let i = this.pos + 1; i < this.text.length; i++) {
      const c = this.text.charCodeAt(i);
      if (c === quote) {
        this.pos = i + 1;
        return true;
      }
      if (c === 92 || c === 10 || c === 13 || c === 0x2028 || c === 0x2029) return false;
    }
    return false;
  }

  /** `0`, `12`, `-3.5`: no leading zeros, exponents, or trailing identifier. */
  private numberLiteral(): boolean {
    let i = this.pos;
    if (this.text.charCodeAt(i) === 45) i++;
    const digitsStart = i;
    while (isDigit(this.text.charCodeAt(i))) i++;
    if (i === digitsStart || (i - digitsStart > 1 && this.text.charCodeAt(digitsStart) === 48)) return false;
    if (this.text.charCodeAt(i) === 46) {
      const fractionStart = ++i;
      while (isDigit(this.text.charCodeAt(i))) i++;
      if (i === fractionStart) return false;
    }
    if (isIdentifierPart(this.text.charCodeAt(i)) || this.text.charCodeAt(i) === 46) return false;
    this.pos = i;
    return true;
  }

  /** A function type, else a union of intersections. */
  private type(): boolean {
    if (this.peek() === 40) {
      const start = this.pos;
      if (this.functionType()) return true;
      this.pos = start;
    }
    do {
      if (!this.intersection()) return false;
    } while (this.eat("|"));
    return true;
  }

  private intersection(): boolean {
    do {
      if (!this.operatorType()) return false;
    } while (this.eat("&"));
    return true;
  }

  /** `keyof T`, or a primary type with `[]` / `[K]` suffixes. */
  private operatorType(): boolean {
    const start = this.pos;
    if (this.identifier() === "keyof") return this.operatorType();
    this.pos = start;
    if (!this.primary()) return false;
    while (this.eat("[")) {
      if (this.eat("]")) continue;
      if (!this.type() || !this.eat("]")) return false;
    }
    return true;
  }

  private primary(): boolean {
    const c = this.peek();
    if (c === 40) {
      this.pos++;
      return this.type() && this.eat(")");
    }
    if (c === 123) return this.objectType();
    if (c === 91) return this.tupleType();
    if (c === 34 || c === 39) return this.stringLiteral();
    if (c === 45 || isDigit(c)) return this.numberLiteral();

    const word = this.identifier();
    if (word === undefined) return false;
    if (word === "typeof") return this.typeofOperand();
    if (word === "import") return this.importType(true);
    if (STANDALONE_TYPE_WORDS.has(word)) return this.peek() !== 46 && this.peek() !== 60;
    if (RESERVED_WORDS.has(word)) return false;
    while (this.eat(".")) {
      if (this.identifier() === undefined) return false;
    }
    if (this.eat("<")) {
      do {
        if (!this.type()) return false;
      } while (this.eat(","));
      return this.eat(">");
    }
    return true;
  }

  /** `a.b.c` or `import("x").a` after `typeof`. */
  private typeofOperand(): boolean {
    const start = this.pos;
    if (this.identifier() === "import") return this.importType(false);
    this.pos = start;
    return this.entityName();
  }

  /**
   * `import("x")`, `import("x").A.B`, and (unless after `typeof`)
   * `import("x").A<T>`, with `import` already read.
   */
  private importType(allowTypeArguments: boolean): boolean {
    if (!this.eat("(") || !this.stringLiteral() || !this.eat(")")) return false;
    while (this.eat(".")) {
      const word = this.identifier();
      if (word === undefined || RESERVED_WORDS.has(word)) return false;
    }
    if (allowTypeArguments && this.eat("<")) {
      do {
        if (!this.type()) return false;
      } while (this.eat(","));
      return this.eat(">");
    }
    return true;
  }

  /** `a.b.c` after `typeof`. */
  private entityName(): boolean {
    do {
      const word = this.identifier();
      if (word === undefined || RESERVED_WORDS.has(word)) return false;
    } while (this.eat("."));
    return true;
  }

  /** `{ a: T; "b"?: U, ["c"]: V; [key: string]: W }` */
  private objectType(): boolean {
    this.pos++;
    while (!this.eat("}")) {
      if (!this.typeMember()) return false;
      if (!this.eat(";") && !this.eat(",") && this.peek() !== 125) return false;
    }
    return true;
  }

  private typeMember(): boolean {
    if (this.eat("[")) {
      if (this.peek() === 34 || this.peek() === 39) {
        if (!this.stringLiteral() || !this.eat("]")) return false;
      } else {
        const key = this.identifier();
        if (key === undefined || RESERVED_WORDS.has(key)) return false;
        if (!this.eat(":") || !this.type() || !this.eat("]")) return false;
        return this.eat(":") && this.type();
      }
    } else if (this.peek() === 34 || this.peek() === 39) {
      if (!this.stringLiteral()) return false;
    } else {
      const key = this.identifier();
      if (key === undefined || MODIFIER_KEYS.has(key)) return false;
    }
    this.eat("?");
    return this.eat(":") && this.type();
  }

  /** `[]` or `[A, B]`. */
  private tupleType(): boolean {
    this.pos++;
    if (this.eat("]")) return true;
    do {
      if (!this.type()) return false;
    } while (this.eat(","));
    return this.eat("]");
  }

  /** `(a: A, b?: B, ...rest: C[]) => R` */
  private functionType(): boolean {
    this.pos++;
    const names = new Set<string>();
    if (!this.eat(")")) {
      do {
        this.skipSpaces();
        const isRest = this.text.startsWith("...", this.pos);
        if (isRest) this.pos += 3;
        const name = this.identifier();
        if (name === undefined || RESERVED_WORDS.has(name) || names.has(name)) return false;
        names.add(name);
        if (!isRest) this.eat("?");
        if (!this.eat(":") || !this.type()) return false;
        if (isRest) break;
      } while (this.eat(","));
      if (!this.eat(")")) return false;
    }
    this.skipSpaces();
    if (!this.text.startsWith("=>", this.pos)) return false;
    this.pos += 2;
    return this.type();
  }
}

/**
 * Whether `typeText` is certainly one valid TypeScript type. `false` means
 * unknown, not invalid: the caller must ask the real parser.
 */
export function isRecognizedTypeText(typeText: string): boolean {
  return new TypeSyntaxRecognizer(typeText).recognize();
}
