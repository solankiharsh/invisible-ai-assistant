import { useState, useEffect, useCallback } from "react";
import { Button, Input } from "@/components";
import {
  getPageById,
  createPage,
  updatePage,
} from "@/lib/database/knowledge.action";
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const PageEditor = ({
  pageId,
  onSave,
}: {
  pageId: string | null;
  onSave?: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(!!pageId);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!pageId || pageId === "new") return;
    setLoading(true);
    try {
      const page = await getPageById(pageId);
      if (page) {
        setTitle(page.title);
        setContent(page.content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    const t = title.trim() || "Untitled";
    setSaving(true);
    try {
      if (pageId && pageId !== "new") {
        await updatePage(pageId, { title: t, content });
      } else {
        const id = generateId("page");
        await createPage({
          id,
          title: t,
          content,
          sourceItemId: null,
        });
        onSave?.();
        window.history.replaceState(null, "", `/knowledge/pages/${id}`);
      }
      onSave?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Page title"
        className="text-lg font-medium"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write in Markdown..."
        className="min-h-[400px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
        spellCheck={false}
      />
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
};
