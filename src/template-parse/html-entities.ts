import entities from "./html-entities-data";

/**
 * WHATWG HTML character-reference decoding, from svelte's
 * `phases/1-parse/utils/html.js`. Needed so `Text.data` and attribute-value
 * `.data` match svelte's parser.
 */

const WINDOWS_1252 = [
  8364, 129, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 141, 381, 143, 144, 8216, 8217, 8220, 8221,
  8226, 8211, 8212, 732, 8482, 353, 8250, 339, 157, 382, 376,
];

function regExpEntity(entityName: string, isAttributeValue: boolean): string {
  if (isAttributeValue && !entityName.endsWith(";")) {
    return `${entityName}\\b(?!=)`;
  }
  return entityName;
}

function getEntityPattern(isAttributeValue: boolean): RegExp {
  const numericPattern = "#(?:x[a-fA-F\\d]+|\\d+)(?:;)?";
  const namedPatterns = Object.keys(entities).map((entityName) => regExpEntity(entityName, isAttributeValue));
  return new RegExp(`&(${numericPattern}|${namedPatterns.join("|")})`, "g");
}

let entityPatternContent: RegExp | undefined;
let entityPatternAttributeValue: RegExp | undefined;

function entityPattern(isAttributeValue: boolean): RegExp {
  if (isAttributeValue) {
    if (!entityPatternAttributeValue) entityPatternAttributeValue = getEntityPattern(true);
    return entityPatternAttributeValue;
  }
  if (!entityPatternContent) entityPatternContent = getEntityPattern(false);
  return entityPatternContent;
}

const NUL = 0;

function validateCode(code: number): number {
  // line feed becomes generic whitespace
  if (code === 10) return 32;

  // ASCII range
  if (code < 128) return code;

  // Browsers treat 128-159 leniently. They're wrong. Remap to windows-1252
  // or missing symbols like "€" show up as replacement characters.
  if (code <= 159) return WINDOWS_1252[code - 128];

  // basic multilingual plane
  if (code < 55296) return code;

  // UTF-16 surrogate halves
  if (code <= 57343) return NUL;

  // rest of the basic multilingual plane
  if (code <= 65535) return code;

  // supplementary multilingual plane
  if (code >= 65536 && code <= 131071) return code;

  // supplementary ideographic plane
  if (code >= 131072 && code <= 196607) return code;

  // supplementary special-purpose plane
  if ((code >= 917504 && code <= 917631) || (code >= 917760 && code <= 917999)) return code;

  return NUL;
}

export function decodeCharacterReferences(html: string, isAttributeValue: boolean): string {
  // Attribute values rarely contain entities. The named-entity regex is huge.
  if (html.indexOf("&") === -1) return html;

  return html.replace(entityPattern(isAttributeValue), (match: string, entity: string) => {
    let code: number;

    if (entity[0] !== "#") {
      code = entities[entity];
    } else if (entity[1] === "x") {
      code = Number.parseInt(entity.substring(2), 16);
    } else {
      code = Number.parseInt(entity.substring(1), 10);
    }

    if (!code) return match;
    return String.fromCodePoint(validateCode(code));
  });
}
