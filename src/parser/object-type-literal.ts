/**
 * Splits a TypeScript object-type body on top-level `;`/`,` member separators,
 * ignoring separators nested inside `<>`, `()`, `[]`, or `{}`.
 */
function splitTopLevelMembers(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
    else if (char === ">" || char === ")" || char === "]" || char === "}") depth = Math.max(depth - 1, 0);
    else if (depth === 0 && (char === ";" || char === ",")) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

/** Index of the first top-level `:` (name/type separator), or -1 if none. */
function findTopLevelColon(value: string): number {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
    else if (char === ">" || char === ")" || char === "]" || char === "}") depth = Math.max(depth - 1, 0);
    else if (depth === 0 && char === ":") return i;
  }
  return -1;
}

const OBJECT_TYPE_LITERAL_REGEX = /^\{([\s\S]*)\}$/;
const MEMBER_NAME_REGEX = /^[A-Za-z_$][\w$]*$/;

export interface ObjectTypeLiteralMember {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Parses an inline TypeScript object-type literal (e.g. `"{ a: string; b?: number }"`)
 * into its member list. Returns `null` when `typeText` isn't an object-type literal,
 * or when a member can't be split into `name: type` (index signatures, mapped types,
 * computed names) so the caller can fall back to treating the type as unresolved.
 */
export function parseObjectTypeLiteralMembers(typeText: string): ObjectTypeLiteralMember[] | null {
  const trimmed = typeText.trim();
  const match = OBJECT_TYPE_LITERAL_REGEX.exec(trimmed);
  if (!match) return null;

  const body = match[1].trim();
  if (body === "") return [];

  const members: ObjectTypeLiteralMember[] = [];

  for (const rawMember of splitTopLevelMembers(body)) {
    const member = rawMember.trim();
    if (!member) continue;

    const colonIndex = findTopLevelColon(member);
    if (colonIndex === -1) return null;

    let name = member.slice(0, colonIndex).trim();
    const type = member.slice(colonIndex + 1).trim();
    if (!type) return null;

    let optional = false;
    if (name.endsWith("?")) {
      optional = true;
      name = name.slice(0, -1).trim();
    }

    if (!MEMBER_NAME_REGEX.test(name)) return null;

    members.push({ name, type, optional });
  }

  return members;
}
