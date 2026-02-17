import { TagBadge } from "./TagBadge";
import type { KnowledgeItemWithTags } from "@/types";

export const ItemCard = ({
  item,
  onSelect,
  snippet,
}: {
  item: KnowledgeItemWithTags;
  onSelect?: (id: string) => void;
  snippet?: string;
}) => {
  const displaySummary = snippet ?? item.summary ?? item.content.slice(0, 120);
  const truncated =
    displaySummary.length > 160
      ? displaySummary.slice(0, 160).trim() + "…"
      : displaySummary;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.(item.id);
      }}
      className="rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm line-clamp-1">{item.title}</h3>
        <span className="shrink-0 text-[10px] text-muted-foreground uppercase">
          {item.type}
        </span>
      </div>
      {truncated && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
          {truncated}
        </p>
      )}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
};
