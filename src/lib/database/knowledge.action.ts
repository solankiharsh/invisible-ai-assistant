import { getDatabase } from "./config";
import type {
  KnowledgeItem,
  Tag,
  Project,
  Page,
  KnowledgeItemWithTags,
} from "@/types";

const KNOWLEDGE_ITEM_TYPES = ["conversation", "transcription", "page"] as const;

/** Tauri plugin-sql select can return a single row or array; normalize to array. */
function selectAsArray<T>(raw: T | T[] | null | undefined): T[] {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// --- Knowledge items ---

export async function createKnowledgeItem(
  item: Omit<KnowledgeItem, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
  }
): Promise<KnowledgeItem> {
  const db = await getDatabase();
  const now = Date.now();
  const createdAt = item.createdAt ?? now;
  const updatedAt = item.updatedAt ?? now;
  if (!KNOWLEDGE_ITEM_TYPES.includes(item.type)) {
    throw new Error(`Invalid knowledge item type: ${item.type}`);
  }
  await db.execute(
    `INSERT INTO knowledge_items (id, type, title, content, summary, source_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.type,
      item.title,
      item.content,
      item.summary ?? null,
      item.sourceId ?? null,
      createdAt,
      updatedAt,
    ]
  );
  return {
    ...item,
    summary: item.summary ?? null,
    sourceId: item.sourceId ?? null,
    createdAt,
    updatedAt,
  };
}

export async function getKnowledgeItemById(
  id: string
): Promise<KnowledgeItem | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      type: string;
      title: string;
      content: string;
      summary: string | null;
      source_id: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM knowledge_items WHERE id = ?", [id])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getKnowledgeItemBySourceId(
  sourceId: string
): Promise<KnowledgeItem | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      type: string;
      title: string;
      content: string;
      summary: string | null;
      source_id: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM knowledge_items WHERE source_id = ?", [sourceId])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function updateKnowledgeItem(
  id: string,
  updates: Partial<
    Pick<KnowledgeItem, "title" | "content" | "summary" | "updatedAt">
  >
): Promise<KnowledgeItem | null> {
  const existing = await getKnowledgeItemById(id);
  if (!existing) return null;
  const db = await getDatabase();
  const updatedAt = updates.updatedAt ?? Date.now();
  await db.execute(
    `UPDATE knowledge_items SET title = ?, content = ?, summary = ?, updated_at = ? WHERE id = ?`,
    [
      updates.title ?? existing.title,
      updates.content ?? existing.content,
      updates.summary !== undefined ? updates.summary : existing.summary,
      updatedAt,
      id,
    ]
  );
  return getKnowledgeItemById(id);
}

export async function deleteKnowledgeItem(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.execute("DELETE FROM knowledge_items WHERE id = ?", [
    id,
  ]);
  return result.rowsAffected > 0;
}

export async function getAllKnowledgeItems(limit = 500): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      type: string;
      title: string;
      content: string;
      summary: string | null;
      source_id: string | null;
      created_at: number;
      updated_at: number;
    }>(
      "SELECT * FROM knowledge_items ORDER BY updated_at DESC LIMIT ?",
      [limit]
    )
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getKnowledgeItemsByTagId(
  tagId: string
): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      type: string;
      title: string;
      content: string;
      summary: string | null;
      source_id: string | null;
      created_at: number;
      updated_at: number;
    }>(
      `SELECT k.* FROM knowledge_items k
     INNER JOIN item_tags it ON it.item_id = k.id
     WHERE it.tag_id = ?
     ORDER BY k.updated_at DESC`,
      [tagId]
    )
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getKnowledgeItemsByProjectId(
  projectId: string
): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      type: string;
      title: string;
      content: string;
      summary: string | null;
      source_id: string | null;
      created_at: number;
      updated_at: number;
    }>(
      `SELECT k.* FROM knowledge_items k
     INNER JOIN project_items pi ON pi.item_id = k.id
     WHERE pi.project_id = ?
     ORDER BY k.updated_at DESC`,
      [projectId]
    )
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// --- Embeddings ---

export async function insertEmbedding(
  id: string,
  itemId: string,
  chunkIndex: number,
  chunkText: string,
  embeddingJson: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO embeddings (id, item_id, chunk_index, chunk_text, embedding, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, itemId, chunkIndex, chunkText, embeddingJson, Date.now()]
  );
}

export async function getEmbeddingsByItemId(
  itemId: string
): Promise<{ id: string; chunkIndex: number; chunkText: string; embedding: string }[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      chunk_index: number;
      chunk_text: string;
      embedding: string;
    }>("SELECT id, chunk_index, chunk_text, embedding FROM embeddings WHERE item_id = ? ORDER BY chunk_index", [
      itemId,
    ])
  );
  return rows.map((r) => ({
    id: r.id,
    chunkIndex: r.chunk_index,
    chunkText: r.chunk_text,
    embedding: r.embedding,
  }));
}

export async function getAllEmbeddings(): Promise<
  { id: string; itemId: string; chunkIndex: number; chunkText: string; embedding: string }[]
> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      item_id: string;
      chunk_index: number;
      chunk_text: string;
      embedding: string;
    }>("SELECT id, item_id, chunk_index, chunk_text, embedding FROM embeddings")
  );
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    chunkIndex: r.chunk_index,
    chunkText: r.chunk_text,
    embedding: r.embedding,
  }));
}

export async function deleteEmbeddingsByItemId(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM embeddings WHERE item_id = ?", [itemId]);
}

// --- Tags ---

export async function createTag(
  id: string,
  name: string,
  color: string | null = null,
  isAuto = false
): Promise<Tag> {
  const db = await getDatabase();
  await db.execute(
    "INSERT INTO tags (id, name, color, is_auto) VALUES (?, ?, ?, ?)",
    [id, name, color, isAuto ? 1 : 0]
  );
  return { id, name, color, isAuto };
}

export async function getTagById(id: string): Promise<Tag | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      color: string | null;
      is_auto: number;
    }>("SELECT * FROM tags WHERE id = ?", [id])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, color: r.color, isAuto: r.is_auto === 1 };
}

export async function getTagByName(name: string): Promise<Tag | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      color: string | null;
      is_auto: number;
    }>("SELECT * FROM tags WHERE name = ?", [name])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, color: r.color, isAuto: r.is_auto === 1 };
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      color: string | null;
      is_auto: number;
    }>("SELECT * FROM tags ORDER BY name")
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    isAuto: r.is_auto === 1,
  }));
}

export async function addTagToItem(itemId: string, tagId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
    [itemId, tagId]
  );
}

export async function removeTagFromItem(
  itemId: string,
  tagId: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?", [
    itemId,
    tagId,
  ]);
}

export async function getTagsForItem(itemId: string): Promise<Tag[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      color: string | null;
      is_auto: number;
    }>(
      `SELECT t.* FROM tags t INNER JOIN item_tags it ON it.tag_id = t.id WHERE it.item_id = ?`,
      [itemId]
    )
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    isAuto: r.is_auto === 1,
  }));
}

// --- Projects ---

export async function createProject(
  project: Omit<Project, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
  }
): Promise<Project> {
  const db = await getDatabase();
  const now = Date.now();
  const createdAt = project.createdAt ?? now;
  const updatedAt = project.updatedAt ?? now;
  await db.execute(
    `INSERT INTO projects (id, name, description, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.name,
      project.description ?? null,
      project.color ?? null,
      createdAt,
      updatedAt,
    ]
  );
  return {
    ...project,
    description: project.description ?? null,
    color: project.color ?? null,
    createdAt,
    updatedAt,
  };
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM projects WHERE id = ?", [id])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM projects ORDER BY updated_at DESC")
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addItemToProject(
  projectId: string,
  itemId: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "INSERT OR IGNORE INTO project_items (project_id, item_id) VALUES (?, ?)",
    [projectId, itemId]
  );
}

export async function removeItemFromProject(
  projectId: string,
  itemId: string
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    "DELETE FROM project_items WHERE project_id = ? AND item_id = ?",
    [projectId, itemId]
  );
}

// --- Pages ---

export async function createPage(
  page: Omit<Page, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
  }
): Promise<Page> {
  const db = await getDatabase();
  const now = Date.now();
  const createdAt = page.createdAt ?? now;
  const updatedAt = page.updatedAt ?? now;
  await db.execute(
    `INSERT INTO pages (id, title, content, source_item_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      page.id,
      page.title,
      page.content ?? "",
      page.sourceItemId ?? null,
      createdAt,
      updatedAt,
    ]
  );
  return {
    ...page,
    content: page.content ?? "",
    sourceItemId: page.sourceItemId ?? null,
    createdAt,
    updatedAt,
  };
}

export async function getPageById(id: string): Promise<Page | null> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      title: string;
      content: string;
      source_item_id: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM pages WHERE id = ?", [id])
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    sourceItemId: r.source_item_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function updatePage(
  id: string,
  updates: Partial<Pick<Page, "title" | "content" | "updatedAt">>
): Promise<Page | null> {
  const existing = await getPageById(id);
  if (!existing) return null;
  const db = await getDatabase();
  const updatedAt = updates.updatedAt ?? Date.now();
  await db.execute(
    "UPDATE pages SET title = ?, content = ?, updated_at = ? WHERE id = ?",
    [
      updates.title ?? existing.title,
      updates.content ?? existing.content,
      updatedAt,
      id,
    ]
  );
  return getPageById(id);
}

export async function deletePage(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.execute("DELETE FROM pages WHERE id = ?", [id]);
  return result.rowsAffected > 0;
}

export async function getAllPages(): Promise<Page[]> {
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{
      id: string;
      title: string;
      content: string;
      source_item_id: string | null;
      created_at: number;
      updated_at: number;
    }>("SELECT * FROM pages ORDER BY updated_at DESC")
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    sourceItemId: r.source_item_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// --- Full-text search (keyword fallback) ---

export interface FtsSearchRow {
  rowid: number;
  title: string;
  content: string;
  summary: string;
}

export async function knowledgeFtsSearch(
  query: string,
  limit = 20
): Promise<KnowledgeItem[]> {
  if (!query.trim()) return [];
  const db = await getDatabase();
  const rows = selectAsArray(
    await db.select<{ rowid: number }>(
      `SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ? LIMIT ?`,
      [query.trim(), limit]
    )
  );
  if (rows.length === 0) return [];
  const placeholders = rows.map(() => "?").join(",");
  const ids = rows.map((r) => r.rowid);
  const itemRows = selectAsArray(
    await db.select<{
    id: string;
    type: string;
    title: string;
    content: string;
    summary: string | null;
    source_id: string | null;
    created_at: number;
    updated_at: number;
  }>(
      `SELECT * FROM knowledge_items WHERE rowid IN (${placeholders})`,
      ids
    )
  );
  return itemRows.map((r) => ({
    id: r.id,
    type: r.type as KnowledgeItem["type"],
    title: r.title,
    content: r.content,
    summary: r.summary,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// --- Items with tags (for UI) ---

export async function getKnowledgeItemsWithTags(
  limit = 200
): Promise<KnowledgeItemWithTags[]> {
  const items = await getAllKnowledgeItems(limit);
  const result: KnowledgeItemWithTags[] = [];
  for (const item of items) {
    const tags = await getTagsForItem(item.id);
    result.push({ ...item, tags });
  }
  return result;
}
