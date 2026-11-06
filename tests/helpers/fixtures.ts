import { buildChannelVectors, type ChannelVectors } from '../../src/core/tfidf';
import type { TabDocument } from '../../src/types/tab';

export interface DocInput {
  id: number;
  windowId?: number;
  title?: string;
  hostname?: string;
  hostKey?: string;
  path?: string;
  titleTokens?: string[];
  pathTokens?: string[];
}

export function makeDoc(input: DocInput): TabDocument {
  const hostname = input.hostname ?? 'example.com';
  return {
    id: input.id,
    windowId: input.windowId,
    title: input.title ?? `Tab ${input.id}`,
    hostname,
    hostKey: input.hostKey ?? hostname,
    path: input.path ?? '',
    titleTokens: input.titleTokens ?? [],
    pathTokens: input.pathTokens ?? []
  };
}

export function channelsFor(documents: TabDocument[]): {
  title: ChannelVectors;
  path: ChannelVectors;
} {
  return {
    title: buildChannelVectors(documents.map((document) => document.titleTokens)),
    path: buildChannelVectors(documents.map((document) => document.pathTokens))
  };
}

export function matrixFor(values: number[][]): Float64Array {
  const n = values.length;
  const matrix = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const value = i === j ? 1 : values[i]?.[j] ?? 0;
      matrix[i * n + j] = value;
    }
  }
  return matrix;
}
