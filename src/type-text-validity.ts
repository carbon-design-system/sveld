import { isValidType } from "sveast";

const typeTextValidity = new Map<string, boolean>();

/**
 * Whether `typeText` parses as a single TypeScript type. `inline` because
 * sveld embeds types mid-line (`CustomEvent<${type}>`), where a trailing `//`
 * comment would swallow the rest of the line.
 */
export function isValidTypeText(typeText: string): boolean {
  const cached = typeTextValidity.get(typeText);
  if (cached !== undefined) return cached;

  const valid = isValidType(typeText, { inline: true });
  typeTextValidity.set(typeText, valid);
  return valid;
}
