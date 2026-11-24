import { indexOfTopLevel, splitTopLevel } from "../type-text";

const OBJECT_TYPE_LITERAL_REGEX = /^\{([\s\S]*)\}$/;
const MEMBER_NAME_REGEX = /^[A-Za-z_$][\w$]*$/;
const READONLY_MODIFIER_REGEX = /^readonly\s+/;
const INDEX_SIGNATURE_REGEX = /^\[[\w$]+\s*:[^\]]+\]$/;

export interface ObjectTypeLiteralMember {
  name: string;
  type: string;
  optional: boolean;
  /**
   * Set only with `withReadonly`: whether the member has the
   * `readonly` modifier.
   */
  readonly?: boolean;
}

// `null` when `typeText` isn't an object-type literal, or a member
// can't be split into `name: type` (an index signature, mapped type,
// computed name), so the caller can treat the type as unresolved.
// `skipIndexSignatures` leaves index signatures out instead, for a
// caller that only reads named members. Without `withReadonly`, each
// member's `readonly` modifier is dropped.
export function parseObjectTypeLiteralMembers(
  typeText: string,
  { skipIndexSignatures = false, withReadonly = false } = {},
): ObjectTypeLiteralMember[] | null {
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

    const rawName = member.slice(0, colonIndex).trim();
    let name = rawName.replace(READONLY_MODIFIER_REGEX, "");
    const type = member.slice(colonIndex + 1).trim();
    if (!type) return null;
    if (skipIndexSignatures && INDEX_SIGNATURE_REGEX.test(name)) continue;

    let optional = false;
    if (name.endsWith("?")) {
      optional = true;
      name = name.slice(0, -1).trim();
    }

    if (!MEMBER_NAME_REGEX.test(name)) return null;

    members.push(withReadonly ? { name, type, optional, readonly: rawName !== name } : { name, type, optional });
  }

  return members;
}
