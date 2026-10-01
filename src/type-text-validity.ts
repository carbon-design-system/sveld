import { isValidType } from "sveast";

const typeTextValidity = new Map<string, boolean>();

/**
 * Whether `typeText` parses as a single TypeScript type, e.g. to catch a
 * JSDoc `{"a" | }` before it's copied into a `.d.ts`. Checked as `inline`
 * text: sveld embeds types mid-line (`CustomEvent<${type}>`), where a `//`
 * comment running to the end of the text would comment out the rest of the
 * line. Memoized: a library repeats the same few type strings across
 * components.
 */
export function isValidTypeText(typeText: string): boolean {
  const cached = typeTextValidity.get(typeText);
  if (cached !== undefined) return cached;

  const valid = isValidType(typeText, { inline: true });
  typeTextValidity.set(typeText, valid);
  return valid;
}
