import { invoke } from "@tauri-apps/api/core";
import {
  insertEmbedding,
  deleteEmbeddingsByItemId,
} from "@/lib/database/knowledge.action";

/** Approximate tokens by chars (e.g. 1 token ≈ 4 chars). Target ~500 tokens per chunk. */
const CHUNK_TARGET_CHARS = 2000;
const MIN_CHUNK_CHARS = 200;

/**
 * Split text into chunks by paragraphs, then by sentences, aiming for ~CHUNK_TARGET_CHARS per chunk.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());

  for (const para of paragraphs) {
    if (para.length <= CHUNK_TARGET_CHARS) {
      if (para.length >= MIN_CHUNK_CHARS || chunks.length === 0) {
        chunks.push(para.trim());
      } else if (chunks.length > 0) {
        chunks[chunks.length - 1] = chunks[chunks.length - 1] + "\n\n" + para.trim();
      } else {
        chunks.push(para.trim());
      }
      continue;
    }

    const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    let current = "";
    for (const sent of sentences) {
      if (current.length + sent.length + 1 <= CHUNK_TARGET_CHARS) {
        current = current ? current + " " + sent : sent;
      } else {
        if (current) chunks.push(current);
        current = sent;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.filter((c) => c.length >= MIN_CHUNK_CHARS || chunks.length === 1);
}

/**
 * Generate embedding for one text via Cloak API (Tauri command).
 */
export async function generateEmbeddingForText(text: string): Promise<number[]> {
  const result = await invoke<number[]>("generate_embedding", { text });
  return result;
}

/**
 * Generate embeddings for all chunks of an item's content and persist them.
 * Deletes existing embeddings for the item first.
 */
export async function embedKnowledgeItem(
  itemId: string,
  content: string
): Promise<{ chunkCount: number; error?: string }> {
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  await deleteEmbeddingsByItemId(itemId);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await generateEmbeddingForText(chunk);
      const id = `emb-${itemId}-${i}-${Date.now()}`;
      await insertEmbedding(
        id,
        itemId,
        i,
        chunk,
        JSON.stringify(embedding)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        chunkCount: i,
        error: `Chunk ${i + 1}/${chunks.length}: ${msg}`,
      };
    }
  }

  return { chunkCount: chunks.length };
}
