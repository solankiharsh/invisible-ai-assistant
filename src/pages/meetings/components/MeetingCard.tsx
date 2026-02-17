import type { Meeting } from "@/types/meetings";
import { Clock, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components";

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(status: Meeting["status"]) {
  const map = {
    recording: { label: "Recording", cls: "bg-red-500/20 text-red-400" },
    processing: {
      label: "Generating summary...",
      cls: "bg-amber-500/20 text-amber-400",
    },
    completed: { label: "Completed", cls: "bg-emerald-500/20 text-emerald-400" },
  };
  const s = map[status];
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export const MeetingCard = ({
  meeting,
  onSelect,
  onDelete,
}: {
  meeting: Meeting;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) => {
  const preview = meeting.summary
    ? meeting.summary.replace(/##?\s*/g, "").slice(0, 140)
    : meeting.transcript.slice(0, 140);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(meeting.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(meeting.id);
      }}
      className="group relative rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:bg-muted/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm line-clamp-1 flex-1">
          {meeting.title}
        </h3>
        {statusBadge(meeting.status)}
      </div>

      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {preview.length >= 140 ? preview + "..." : preview}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {formatDate(meeting.createdAt)}
          </span>
          {meeting.durationSeconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(meeting.durationSeconds)}
            </span>
          )}
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(meeting.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
