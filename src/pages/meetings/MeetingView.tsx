import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button, Markdown } from "@/components";
import { useMeetings } from "@/hooks/useMeetings";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Pencil,
} from "lucide-react";

type Tab = "summary" | "notes" | "transcript";

const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "notes", label: "Notes" },
  { id: "transcript", label: "Transcript" },
];

const MeetingView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentMeeting,
    loadMeeting,
    generateSummary,
    updateNotes,
    updateTitle,
    generatingSummary,
  } = useMeetings();

  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [notesValue, setNotesValue] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [copied, setCopied] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) loadMeeting(id);
  }, [id, loadMeeting]);

  useEffect(() => {
    if (currentMeeting) {
      setNotesValue(currentMeeting.notes);
      setTitleValue(currentMeeting.title);
    }
  }, [currentMeeting]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const handleNotesChange = useCallback(
    (val: string) => {
      setNotesValue(val);
      if (notesTimer.current) clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(() => {
        if (id) updateNotes(id, val);
      }, 800);
    },
    [id, updateNotes]
  );

  const handleTitleSave = useCallback(() => {
    setEditingTitle(false);
    if (id && titleValue.trim()) updateTitle(id, titleValue.trim());
  }, [id, titleValue, updateTitle]);

  const handleCopy = useCallback(() => {
    const text =
      activeTab === "summary"
        ? currentMeeting?.summary
        : activeTab === "transcript"
        ? currentMeeting?.transcript
        : notesValue;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeTab, currentMeeting, notesValue]);

  const handleGenerate = useCallback(() => {
    if (id) generateSummary(id);
  }, [id, generateSummary]);

  if (!currentMeeting) {
    return (
      <PageLayout title="Meeting" description="View meeting details">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      </PageLayout>
    );
  }

  const createdDate = new Date(currentMeeting.createdAt);
  const dateStr = createdDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = createdDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <PageLayout
      title={currentMeeting.title}
      description="Summary, notes, and transcript"
      rightSlot={
        <Button variant="ghost" size="sm" onClick={() => navigate("/meetings")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Title (editable) */}
        <div className="group">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") {
                  setTitleValue(currentMeeting.title);
                  setEditingTitle(false);
                }
              }}
              className="text-2xl font-bold bg-transparent border-b border-primary/30 outline-none w-full pb-1"
            />
          ) : (
            <h1
              className="text-2xl font-bold flex items-center gap-2 cursor-pointer hover:text-primary/80 transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {currentMeeting.title}
              <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h1>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {dateStr} at {timeStr}
            {currentMeeting.durationSeconds > 0 && (
              <span>
                {" "}
                &middot;{" "}
                {Math.round(currentMeeting.durationSeconds / 60)} min
              </span>
            )}
          </p>
        </div>

        {/* Tabs (Notion-style) */}
        <div className="flex items-center gap-1 border-b">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-all relative ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Tab content */}
        <div className="min-h-[400px]">
          {activeTab === "summary" && (
            <div className="space-y-4">
              {currentMeeting.summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_li]:text-sm [&_li]:leading-relaxed [&_ul]:space-y-1">
                  <Markdown>{currentMeeting.summary}</Markdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No summary yet.{" "}
                    {currentMeeting.transcript
                      ? "Generate one from the transcript."
                      : "Record a meeting first."}
                  </p>
                  {currentMeeting.transcript && (
                    <Button
                      onClick={handleGenerate}
                      disabled={generatingSummary}
                      size="sm"
                    >
                      {generatingSummary ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Summary
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
              {currentMeeting.summary && currentMeeting.transcript && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generatingSummary}
                  className="mt-4"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Regenerate
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <textarea
              value={notesValue}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add your notes here... (auto-saves)"
              className="w-full min-h-[400px] bg-transparent text-sm leading-relaxed outline-none resize-none placeholder:text-muted-foreground/40"
              spellCheck={false}
            />
          )}

          {activeTab === "transcript" && (
            <div className="space-y-1">
              {currentMeeting.transcript ? (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
                  {currentMeeting.transcript}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground py-16 text-center">
                  No transcript recorded yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default MeetingView;
