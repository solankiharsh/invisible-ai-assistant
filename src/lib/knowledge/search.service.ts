import { invoke } from "@tauri-apps/api/core";
import { getAllEmbeddings, knowledgeFtsSearch } from "@/lib/database/knowledge.action";
import type { KnowledgeItem } from "@/types";
import type { SearchResultChunk } from "@/types/knowledge.type";
import { getKnowledgeItemById } from "@/lib/database/knowledge.action";

/**
 * Cosine similarity between two vectors (same length).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Semantic search: embed query, compare to all stored embeddings, return ranked chunks.
 */
export async function semanticSearch(
  query: string,
  limit = 10,
  itemIdFilter?: string
): Promise<SearchResultChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await invoke<number[]>("generate_embedding", { text: trimmed });
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return [];
  }

  const all = await getAllEmbeddings();
  const scored: { itemId: string; chunkIndex: number; chunkText: string; score: number }[] = [];

  for (const row of all) {
    if (itemIdFilter && row.itemId !== itemIdFilter) continue;
    let vec: number[];
    try {
      vec = JSON.parse(row.embedding) as number[];
    } catch {
      continue;
    }
    const score = cosineSimilarity(queryEmbedding, vec);
    scored.push({
      itemId: row.itemId,
      chunkIndex: row.chunkIndex,
      chunkText: row.chunkText,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  const results: SearchResultChunk[] = [];
  for (const s of top) {
    const item = await getKnowledgeItemById(s.itemId);
    results.push({
      itemId: s.itemId,
      chunkIndex: s.chunkIndex,
      chunkText: s.chunkText,
      score: s.score,
      title: item?.title,
      summary: item?.summary ?? undefined,
    });
  }
  return results;
}

/**
 * Keyword (full-text) search via FTS5.
 */
export async function keywordSearch(
  query: string,
  limit = 20
): Promise<KnowledgeItem[]> {
  return knowledgeFtsSearch(query, limit);
}

/**
 * Hybrid: run semantic search; if no results or query is very short, fall back to FTS.
 */
export async function hybridSearch(
  query: string,
  limit = 15
): Promise<{ semantic: SearchResultChunk[]; keyword: KnowledgeItem[] }> {
  const semantic = await semanticSearch(query, limit);
  const keyword = await keywordSearch(query, limit);
  return { semantic, keyword };
}
