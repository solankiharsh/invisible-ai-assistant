import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { SearchBar, ItemCard } from "./components";
import {
  getKnowledgeItemsWithTags,
  hybridSearch,
  indexAllConversations,
} from "@/lib";
import type { KnowledgeItemWithTags, KnowledgeItem } from "@/types";
import type { SearchResultChunk } from "@/types/knowledge.type";
import { Loader2 } from "lucide-react";

const Knowledge = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<KnowledgeItemWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultChunk[] | null>(null);
  const [keywordResults, setKeywordResults] = useState<KnowledgeItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getKnowledgeItemsWithTags(200);
      setItems(list);
    } catch (err) {
      console.error("Failed to load knowledge items:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearching(true);
    setSearchResults(null);
    setKeywordResults(null);
    try {
      const { semantic, keyword } = await hybridSearch(query, 15);
      setSearchResults(semantic);
      setKeywordResults(keyword);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleIndexAll = useCallback(async () => {
    setIndexing(true);
    try {
      const result = await indexAllConversations();
      console.log("Index result:", result);
      await loadItems();
    } catch (err) {
      console.error("Index failed:", err);
    } finally {
      setIndexing(false);
    }
  }, [loadItems]);

  const showSearchResults = searchQuery.trim() && (searchResults !== null || keywordResults !== null);
  const semanticChunksByItem = new Map<string, SearchResultChunk[]>();
  if (searchResults?.length) {
    for (const r of searchResults) {
      const list = semanticChunksByItem.get(r.itemId) ?? [];
      list.push(r);
      semanticChunksByItem.set(r.itemId, list);
    }
  }

  // Unique tags for filter chips (each item appears once in the list when filtered)
  const uniqueTags = Array.from(
    new Set(items.flatMap((i) => i.tags?.map((t) => t.name) ?? []))
  ).sort((a, b) => a.localeCompare(b));

  const filteredItems = selectedTag
    ? items.filter((item) =>
        item.tags?.some((t) => t.name === selectedTag)
      )
    : items;

  return (
    <PageLayout
      title="Knowledge"
      description="Chat with everything you've saved. Semantic search and filter by tags."
      rightSlot={
        <Button
          variant="outline"
          size="sm"
          onClick={handleIndexAll}
          disabled={indexing || loading}
        >
          {indexing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Indexing…
            </>
          ) : (
            "Index conversations"
          )}
        </Button>
      }
    >
      <div className="space-y-6">
        <SearchBar
          onSearch={handleSearch}
          loading={searching}
          placeholder="Search by meaning or keywords..."
        />

        {showSearchResults && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              Search results
            </h2>
            {searching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from(semanticChunksByItem.entries()).map(([itemId, chunks]) => {
                      const first = chunks[0];
                      const item = items.find((i) => i.id === itemId) ?? {
                        id: itemId,
                        type: "conversation" as const,
                        title: first?.title ?? "Result",
                        content: first?.chunkText ?? "",
                        summary: first?.summary ?? null,
                        sourceId: null,
                        createdAt: 0,
                        updatedAt: 0,
                        tags: [],
                      };
                      return (
                        <ItemCard
                          key={itemId}
                          item={item}
                          snippet={first?.chunkText}
                          onSelect={(id) => navigate(`/knowledge/chat?itemId=${id}`)}
                        />
                      );
                    })}
                  </div>
                ) : null}
                {keywordResults?.length && !searchResults?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {keywordResults.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={{ ...item, tags: [] }}
                        onSelect={(id) => navigate(`/knowledge/chat?itemId=${id}`)}
                      />
                    ))}
                  </div>
                ) : null}
                {!searchResults?.length && !keywordResults?.length && (
                  <p className="text-sm text-muted-foreground">
                    No results. Try different keywords or index more conversations.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {!showSearchResults && (
          <>
            {!loading && uniqueTags.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  Filter by tag
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedTag === null
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    All
                  </button>
                  {uniqueTags.map((tagName) => (
                    <button
                      key={tagName}
                      type="button"
                      onClick={() =>
                        setSelectedTag(selectedTag === tagName ? null : tagName)
                      }
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedTag === tagName
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tagName}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                {selectedTag ? `Tagged: ${selectedTag}` : "Recent"}
              </h2>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedTag
                    ? `No items with tag "${selectedTag}".`
                    : 'No knowledge items yet. Click "Index conversations" to add your chats to the knowledge base.'}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(selectedTag ? filteredItems : filteredItems.slice(0, 12)).map(
                    (item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onSelect={(id) =>
                          navigate(`/knowledge/chat?itemId=${id}`)
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default Knowledge;
