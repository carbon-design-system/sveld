import { indexOfTopLevel, splitTopLevel } from "../type-text";

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

  for (const rawMember of splitTopLevel(body, ";,")) {
    const member = rawMember.trim();
    if (!member) continue;

    const colonIndex = indexOfTopLevel(member, ":");
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
