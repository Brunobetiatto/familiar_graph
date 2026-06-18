type NamedItem = {
  name: string;
};

const MAX_DISTANCE_INPUT_LENGTH = 48;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;

  let cursor = 0;

  for (let index = 0; index < haystack.length && cursor < needle.length; index += 1) {
    if (haystack[index] === needle[cursor]) cursor += 1;
  }

  return cursor === needle.length;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let aIndex = 1; aIndex <= a.length; aIndex += 1) {
    current[0] = aIndex;

    for (let bIndex = 1; bIndex <= b.length; bIndex += 1) {
      const substitutionCost = a[aIndex - 1] === b[bIndex - 1] ? 0 : 1;
      current[bIndex] = Math.min(
        current[bIndex - 1] + 1,
        previous[bIndex] + 1,
        previous[bIndex - 1] + substitutionCost
      );
    }

    for (let index = 0; index <= b.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[b.length];
}

function distanceSimilarity(query: string, target: string): number {
  if (
    !query ||
    !target ||
    query.length > MAX_DISTANCE_INPUT_LENGTH ||
    target.length > MAX_DISTANCE_INPUT_LENGTH
  ) {
    return 0;
  }

  const distance = levenshteinDistance(query, target);
  const longest = Math.max(query.length, target.length);

  return Math.max(0, 1 - distance / longest);
}

function tokenScore(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  const scores = queryTokens.map((queryToken) => {
    let best = 0;

    targetTokens.forEach((targetToken) => {
      if (targetToken === queryToken) best = Math.max(best, 1);
      else if (targetToken.startsWith(queryToken)) best = Math.max(best, 0.92);
      else if (targetToken.includes(queryToken)) best = Math.max(best, 0.76);
      else if (isSubsequence(queryToken, targetToken)) best = Math.max(best, 0.62);
      else best = Math.max(best, distanceSimilarity(queryToken, targetToken) * 0.88);
    });

    return best;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function fuzzySearchItems<T extends NamedItem>(
  items: T[],
  rawQuery: string,
  limit: number
): T[] {
  const query = normalizeSearchText(rawQuery);
  const queryTokens = query.split(' ').filter(Boolean);

  if (query.length < 2) return [];

  return items
    .map((item) => {
      const normalizedName = normalizeSearchText(item.name);
      const targetTokens = normalizedName.split(' ').filter(Boolean);
      const exactScore = normalizedName === query ? 1.5 : 0;
      const prefixScore = normalizedName.startsWith(query) ? 1.28 : 0;
      const containsScore = normalizedName.includes(query) ? 1.08 : 0;
      const subsequenceScore = isSubsequence(query.replace(/\s/g, ''), normalizedName.replace(/\s/g, ''))
        ? 0.72
        : 0;
      const score = Math.max(
        exactScore,
        prefixScore,
        containsScore,
        tokenScore(queryTokens, targetTokens),
        distanceSimilarity(query, normalizedName),
        subsequenceScore
      );

      return { item, score, normalizedName };
    })
    .filter(({ score }) => score >= 0.58)
    .sort((a, b) => b.score - a.score || a.normalizedName.localeCompare(b.normalizedName))
    .slice(0, limit)
    .map(({ item }) => item);
}
