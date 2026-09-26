/** Largest edit distance for which a typo suggestion is still offered. */
const MAX_SUGGESTION_DISTANCE = 3;

/** Edit distance between two strings, counting a swap of adjacent characters (`evnet`) as one edit. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));

  for (let i = 0; i < rows; i++) distances[i][0] = i;
  for (let j = 0; j < columns; j++) distances[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < columns; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + substitutionCost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distances[i][j] = Math.min(distances[i][j], distances[i - 2][j - 2] + 1);
      }
    }
  }

  return distances[rows - 1][columns - 1];
}

/**
 * Closest candidate string to `input` by edit distance, or `undefined` if
 * none is within `maxDistance`.
 */
export function closestMatch(
  input: string,
  candidates: Iterable<string>,
  maxDistance = MAX_SUGGESTION_DISTANCE,
): string | undefined {
  let closest: string | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(input, candidate);

    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  if (closest === undefined || closestDistance > maxDistance) {
    return undefined;
  }

  return closest;
}
