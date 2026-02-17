import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { ItemCard } from "./components";
import { getKnowledgeItemsByProjectId } from "@/lib/database/knowledge.action";
import type { KnowledgeItemWithTags } from "@/types";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const ProjectViewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<KnowledgeItemWithTags[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const list = await getKnowledgeItemsByProjectId(id);
      setItems(list.map((i) => ({ ...i, tags: [] })));
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      title="Project"
      description="Items in this project."
      rightSlot={
        <Button variant="ghost" size="sm" onClick={() => navigate("/knowledge/projects")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to projects
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items in this project.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onSelect={(itemId) => navigate(`/knowledge/chat?itemId=${itemId}`)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default ProjectViewPage;
