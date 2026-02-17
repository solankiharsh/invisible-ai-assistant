import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { getAllPages } from "@/lib/database/knowledge.action";
import type { Page } from "@/types";
import { FileTextIcon, PlusIcon } from "lucide-react";

const PagesListPage = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllPages();
      setPages(list);
    } catch (err) {
      console.error(err);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      title="Pages"
      description="Notion-like documents saved from your knowledge base."
      rightSlot={
        <Button size="sm" onClick={() => navigate("/knowledge/pages/new")}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New page
        </Button>
      }
    >
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pages yet. Create one from the Knowledge hub or from a chat.
          </p>
        ) : (
          pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => navigate(`/knowledge/pages/${page.id}`)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
            >
              <FileTextIcon className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{page.title}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(page.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </PageLayout>
  );
};

export default PagesListPage;
