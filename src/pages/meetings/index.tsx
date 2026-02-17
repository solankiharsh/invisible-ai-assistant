import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { MeetingCard } from "./components";
import { useMeetings } from "@/hooks/useMeetings";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Loader2, CalendarDays, Plus, ExternalLink } from "lucide-react";

const Meetings = () => {
  const navigate = useNavigate();
  const { meetings, loading, createFromTranscript, removeMeeting } =
    useMeetings();

  const { connected: calConnected, events, loadingEvents } =
    useGoogleCalendar();

  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    const meeting = await createFromTranscript(
      "",
      `Meeting ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    );
    if (meeting) {
      navigate(`/meetings/${meeting.id}`);
    }
    setCreating(false);
  }, [createFromTranscript, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (confirm("Delete this meeting?")) {
        await removeMeeting(id);
      }
    },
    [removeMeeting]
  );

  return (
    <PageLayout
      title="Meetings"
      description="Call summaries, transcripts, and notes. Auto-generated after each session."
      rightSlot={
        <Button size="sm" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            New Meeting
          </Button>
      }
    >
      <div className="space-y-6">
        {/* Upcoming Calendar Events (auto-loaded when connected) */}
        {calConnected && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Upcoming from Google Calendar
              {loadingEvents && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </h2>
            {loadingEvents && events.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading upcoming events…
              </div>
            ) : events.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {events.slice(0, 6).map((event) => {
                const start = event.start.dateTime
                  ? new Date(event.start.dateTime)
                  : event.start.date
                  ? new Date(event.start.date)
                  : null;
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border bg-card p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium line-clamp-1">
                        {event.summary || "Untitled"}
                      </span>
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {start && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {start.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at{" "}
                        {start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                        {event.attendees
                          .slice(0, 3)
                          .map((a) => a.displayName || a.email)
                          .join(", ")}
                        {event.attendees.length > 3 &&
                          ` +${event.attendees.length - 3}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No upcoming events
              </p>
            )}
          </section>
        )}

        {/* All Meetings */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            {meetings.length > 0
              ? `All Meetings (${meetings.length})`
              : "Meetings"}
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No meetings yet
              </p>
              <p className="text-xs text-muted-foreground/70 mb-4 max-w-xs">
                Meetings are automatically saved when you use the audio capture
                feature, or create one manually.
              </p>
              <Button size="sm" variant="outline" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-1" /> Create your first meeting
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onSelect={(id) => navigate(`/meetings/${id}`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>

        {/* Calendar connection prompt */}
        {!calConnected && (
          <section className="border rounded-xl bg-card p-6 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">
              Connect Google Calendar
            </h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-sm mx-auto">
              See upcoming meetings and auto-name your recordings based on
              calendar events.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              Set up in Settings
            </Button>
          </section>
        )}
      </div>
    </PageLayout>
  );
};

export default Meetings;
