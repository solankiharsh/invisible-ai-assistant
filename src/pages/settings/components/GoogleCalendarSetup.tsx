import { useState } from "react";
import { Button, Input } from "@/components";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import {
  CalendarDays,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Unplug,
} from "lucide-react";

export const GoogleCalendarSetup = () => {
  const {
    connected,
    connecting,
    error,
    clientId,
    clientSecret,
    setClientId,
    setClientSecret,
    connect,
    disconnect,
    events,
    loadingEvents,
  } = useGoogleCalendar();

  const [showSecret, setShowSecret] = useState(false);
  const [showSetup, setShowSetup] = useState(!connected && !clientId);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <CalendarDays className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Google Calendar</h3>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Connected — upcoming events sync automatically"
                : "Connect to see upcoming meetings"}
            </p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check className="h-3 w-3" /> Connected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={disconnect}
            >
              <Unplug className="h-3 w-3 mr-1" /> Disconnect
            </Button>
          </div>
        )}
      </div>

      {!connected && (
        <>
          {!showSetup ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSetup(true)}
            >
              Set up Google Calendar
            </Button>
          ) : (
            <div className="space-y-3 pt-2 border-t">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">
                  Setup instructions:
                </p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>
                    Go to{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </li>
                  <li>Create an OAuth 2.0 Client ID (Desktop app type)</li>
                  <li>Enable the Google Calendar API</li>
                  <li>
                    Copy your Client ID and Client Secret below
                  </li>
                </ol>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Client ID</label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123456789.apps.googleusercontent.com"
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Client Secret</label>
                <div className="relative">
                  <Input
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    type={showSecret ? "text" : "password"}
                    placeholder="GOCSPX-..."
                    className="text-xs pr-9"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-9"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <Button
                onClick={connect}
                disabled={connecting || !clientId || !clientSecret}
                size="sm"
                className="w-full"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Waiting for authorization...
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Sign in with Google
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {connected && (
        <div className="pt-2 border-t">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Upcoming events
            </span>
          </div>
          {loadingEvents ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-1.5">
              {events.slice(0, 5).map((event) => {
                const start = event.start.dateTime
                  ? new Date(event.start.dateTime)
                  : null;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-xs rounded-md px-2 py-1.5 bg-muted/50"
                  >
                    <span className="font-medium flex-1 line-clamp-1">
                      {event.summary || "Untitled"}
                    </span>
                    {start && (
                      <span className="text-muted-foreground shrink-0">
                        {start.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              No upcoming events
            </p>
          )}
        </div>
      )}
    </div>
  );
};
