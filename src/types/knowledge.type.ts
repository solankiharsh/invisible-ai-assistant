export type KnowledgeItemType = "conversation" | "transcription" | "page";

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title: string;
  content: string;
  summary: string | null;
  sourceId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EmbeddingRecord {
  id: string;
  itemId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: string; // JSON array of floats
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  isAuto: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  sourceItemId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeItemWithTags extends KnowledgeItem {
  tags: Tag[];
}

export interface SearchResultChunk {
  itemId: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
  title?: string;
  summary?: string | null;
}
