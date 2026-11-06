export interface ChannelVectors {
  vectors: Map<string, number>[];
  idf: Map<string, number>;
  vocabulary: string[];
}

/**
 * Build per-channel TF-IDF vectors with the smoothed IDF from the project plan:
 *   idf(t) = ln((N + 1) / (df(t) + 1)) + 1
 * N is every analysed tab, including tabs with an empty channel.
 */
export function buildChannelVectors(tokenLists: string[][]): ChannelVectors {
  const documentCount = tokenLists.length;
  if (documentCount === 0) {
    return { vectors: [], idf: new Map(), vocabulary: [] };
  }

  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenLists) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, df] of documentFrequency) {
    idf.set(token, Math.log((documentCount + 1) / (df + 1)) + 1);
  }

  const vectors = tokenLists.map((tokens) => {
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    const weighted = new Map<string, number>();
    let squaredNorm = 0;
    for (const [token, count] of termFrequency) {
      const weight = count * (idf.get(token) ?? 0);
      if (weight > 0) {
        weighted.set(token, weight);
        squaredNorm += weight * weight;
      }
    }

    if (squaredNorm === 0) return new Map<string, number>();
    const norm = Math.sqrt(squaredNorm);
    for (const [token, weight] of weighted) {
      weighted.set(token, weight / norm);
    }
    return weighted;
  });

  return {
    vectors,
    idf,
    vocabulary: [...idf.keys()].sort()
  };
}

/** Sparse cosine similarity; iterates the smaller map. */
export function cosineSparse(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, value] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += value * other;
  }
  if (!Number.isFinite(dot)) return 0;
  return Math.min(1, Math.max(0, dot));
}
