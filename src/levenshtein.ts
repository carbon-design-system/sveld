/** Largest edit distance for which a typo suggestion is still offered. */
export const MAX_SUGGESTION_DISTANCE = 3;

/** Classic Levenshtein edit distance between two strings. */
export function levenshteinDistance(a: string, b: string): number {
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
    }
  }

  return distances[rows - 1][columns - 1];
}

/** Closest candidate string to `input` by Levenshtein distance, or `undefined` if none is close enough. */
export function closestMatch(input: string, candidates: Iterable<string>): string | undefined {
  let closest: string | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(input, candidate);

    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  if (closest === undefined || closestDistance > MAX_SUGGESTION_DISTANCE) {
    return undefined;
  }

  return closest;
}
