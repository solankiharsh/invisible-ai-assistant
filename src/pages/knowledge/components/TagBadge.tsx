import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

export const TagBadge = ({
  tag,
  className,
}: {
  tag: Tag;
  className?: string;
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground",
        tag.color && "border",
        className
      )}
      style={tag.color ? { borderColor: tag.color } : undefined}
    >
      {tag.name}
    </span>
  );
};
