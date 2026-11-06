export interface ClusteringResult {
  clusters: number[][];
  unclustered: number[];
}

interface HeapEntry {
  score: number;
  a: number;
  b: number;
  versionA: number;
  versionB: number;
}

const EPSILON = 1e-9;

function sanitize(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

function better(first: HeapEntry, second: HeapEntry): boolean {
  if (first.score !== second.score) return first.score > second.score;
  const firstMin = Math.min(first.a, first.b);
  const secondMin = Math.min(second.a, second.b);
  if (firstMin !== secondMin) return firstMin < secondMin;
  const firstMax = Math.max(first.a, first.b);
  const secondMax = Math.max(second.a, second.b);
  if (firstMax !== secondMax) return firstMax < secondMax;
  return first.versionA + first.versionB < second.versionA + second.versionB;
}

class MaxHeap {
  private entries: HeapEntry[] = [];

  get size(): number {
    return this.entries.length;
  }

  push(entry: HeapEntry): void {
    this.entries.push(entry);
    this.bubbleUp(this.entries.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.entries.length === 0) return undefined;
    const top = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length > 0 && last !== undefined) {
      this.entries[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentEntry = this.entries[current]!;
      const parentEntry = this.entries[parent]!;
      if (!better(currentEntry, parentEntry)) break;
      this.entries[current] = parentEntry;
      this.entries[parent] = currentEntry;
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let best = current;
      if (left < this.entries.length && better(this.entries[left]!, this.entries[best]!)) {
        best = left;
      }
      if (right < this.entries.length && better(this.entries[right]!, this.entries[best]!)) {
        best = right;
      }
      if (best === current) break;
      const currentEntry = this.entries[current]!;
      this.entries[current] = this.entries[best]!;
      this.entries[best] = currentEntry;
      current = best;
    }
  }
}

/**
 * Average-linkage agglomerative clustering.
 *
 * Uses Lance-Williams updates and a max-heap with lazy invalidation, giving
 * O(N^2 log N) time and O(N^2) memory rather than recomputing all cluster
 * averages after every merge.
 */
export function clusterSimilarityMatrix(
  matrix: Float64Array,
  n: number,
  threshold: number,
  minClusterSize = 2
): ClusteringResult {
  if (n <= 0) return { clusters: [], unclustered: [] };
  if (n === 1) return { clusters: [], unclustered: [0] };

  const similarities = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    similarities[i * n + i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const score = sanitize(matrix[i * n + j] ?? 0);
      similarities[i * n + j] = score;
      similarities[j * n + i] = score;
    }
  }

  const getSimilarity = (a: number, b: number): number => {
    if (a === b) return 1;
    return sanitize(similarities[a * n + b] ?? 0);
  };

  const active = new Array<boolean>(n).fill(true);
  const version = new Array<number>(n).fill(0);
  const sizes = new Array<number>(n).fill(1);
  const members = new Array<number[]>(n);
  for (let i = 0; i < n; i += 1) members[i] = [i];

  let versionCounter = 0;
  const heap = new MaxHeap();

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const score = getSimilarity(i, j);
      if (score + EPSILON >= threshold) {
        heap.push({ score, a: i, b: j, versionA: 0, versionB: 0 });
      }
    }
  }

  while (heap.size > 0) {
    const entry = heap.pop();
    if (!entry) break;
    const { a, b } = entry;
    if (!active[a] || !active[b] || a === b) continue;
    if (entry.versionA !== version[a] || entry.versionB !== version[b]) continue;
    if (entry.score + EPSILON < threshold) break;

    const sizeA = sizes[a]!;
    const sizeB = sizes[b]!;
    const newId = Math.min(a, b);
    const oldId = Math.max(a, b);
    const mergedMembers = [...members[a]!, ...members[b]!].sort((x, y) => x - y);

    members[newId] = mergedMembers;
    sizes[newId] = sizeA + sizeB;
    version[newId] = ++versionCounter;
    active[newId] = true;
    active[oldId] = false;

    for (let candidate = 0; candidate < n; candidate += 1) {
      if (candidate === newId || !active[candidate]) continue;
      const updated =
        (sizeA * getSimilarity(a, candidate) + sizeB * getSimilarity(b, candidate)) /
        (sizeA + sizeB);
      similarities[newId * n + candidate] = updated;
      similarities[candidate * n + newId] = updated;
      if (updated + EPSILON >= threshold) {
        heap.push({
          score: updated,
          a: newId,
          b: candidate,
          versionA: version[newId]!,
          versionB: version[candidate]!
        });
      }
    }
  }

  const clusters: number[][] = [];
  const unclustered: number[] = [];

  for (let i = 0; i < n; i += 1) {
    if (!active[i]) continue;
    if (sizes[i]! >= minClusterSize) {
      clusters.push([...members[i]!].sort((x, y) => x - y));
    } else {
      unclustered.push(...members[i]!);
    }
  }

  clusters.sort((first, second) => (first[0] ?? 0) - (second[0] ?? 0));
  unclustered.sort((first, second) => first - second);
  return { clusters, unclustered };
}
