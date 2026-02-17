import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getAllConversations } from "@/lib/database/chat-history.action";
import {
  getKnowledgeItemBySourceId,
  createKnowledgeItem,
  updateKnowledgeItem,
  createTag,
  getTagByName,
  addTagToItem,
} from "@/lib/database/knowledge.action";
import { embedKnowledgeItem } from "./embedding.service";

const CHUNK_POLL_INTERVAL_MS = 50;

/**
 * Get a single non-streaming completion from Cloak API by collecting the stream.
 */
async function getCloakCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  let streamComplete = false;
  const streamChunks: string[] = [];

  const unlisten = await listen("chat_stream_chunk", (event: { payload: string }) => {
    streamChunks.push(event.payload);
  });
  const unlistenComplete = await listen("chat_stream_complete", () => {
    streamComplete = true;
  });

  try {
    await invoke("chat_stream_response", {
      userMessage,
      systemPrompt,
      imageBase64: null,
      history: null,
    });

    while (!streamComplete) {
      await new Promise((r) => setTimeout(r, CHUNK_POLL_INTERVAL_MS));
    }
    return streamChunks.join("");
  } finally {
    unlisten();
    unlistenComplete();
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Index one conversation into the knowledge base: create item, summary, embeddings, tags.
 */
export async function indexConversation(conversationId: string): Promise<{
  success: boolean;
  itemId?: string;
  error?: string;
  created?: boolean;
}> {
  const existing = await getKnowledgeItemBySourceId(conversationId);
  if (existing) {
    return { success: true, itemId: existing.id, created: false };
  }

  const conversations = await getAllConversations();
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) {
    return { success: false, error: "Conversation not found", created: false };
  }

  const content = conv.messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n\n");
  const title = conv.title || content.slice(0, 80) + (content.length > 80 ? "…" : "");

  let summary: string;
  try {
    summary = await getCloakCompletion(
      "Summarize the following conversation in 2-3 concise sentences. Output only the summary, no preamble.",
      content.slice(0, 12000)
    );
    summary = summary.trim();
  } catch (err) {
    summary = "";
  }

  const itemId = generateId("ki");
  const now = Date.now();

  try {
    await createKnowledgeItem({
      id: itemId,
      type: "conversation",
      title,
      content,
      summary: summary || null,
      sourceId: conversationId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      created: false,
    };
  }

  const embedResult = await embedKnowledgeItem(itemId, content);
  if (embedResult.error) {
    await updateKnowledgeItem(itemId, { summary: summary || null });
    return {
      success: true,
      itemId,
      error: embedResult.error,
      created: true,
    };
  }

  let tagNames: string[] = [];
  try {
    const tagResponse = await getCloakCompletion(
      "From the following conversation, output 3-5 short topic tags (single words or two words). Output only the tags separated by commas, nothing else.",
      content.slice(0, 8000)
    );
    tagNames = tagResponse
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter((t) => t.length > 0 && t.length < 30)
      .slice(0, 5);
  } catch {
    // ignore tag failure
  }

  for (const name of tagNames) {
    if (!name) continue;
    let tag = await getTagByName(name);
    if (!tag) {
      const tagId = generateId("tag");
      try {
        tag = await createTag(tagId, name, null, true);
      } catch {
        tag = await getTagByName(name);
      }
    }
    if (tag) {
      await addTagToItem(itemId, tag.id);
    }
  }

  return { success: true, itemId, created: true };
}

/**
 * Index all conversations that are not yet in the knowledge base.
 */
export async function indexAllConversations(): Promise<{
  indexed: number;
  failed: number;
  errors: string[];
}> {
  const conversations = await getAllConversations();
  const errors: string[] = [];
  let indexed = 0;
  let failed = 0;

  for (const conv of conversations) {
    const result = await indexConversation(conv.id);
    if (result.success && result.created) {
      indexed++;
    } else if (!result.success) {
      failed++;
      if (result.error) errors.push(`${conv.id}: ${result.error}`);
    }
  }

  return { indexed, failed, errors };
}
