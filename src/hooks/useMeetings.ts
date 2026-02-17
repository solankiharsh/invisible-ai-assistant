import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting as dbDeleteMeeting,
} from "@/lib/database/meetings.action";
import type { Meeting } from "@/types/meetings";

function generateId(): string {
  return `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SUMMARY_SYSTEM_PROMPT = `You are a meeting summarizer. Given a transcript of a meeting or call, create a structured summary. Use this EXACT format with markdown:

## Current Situation
- Key context points as bullet points

## Key Points Discussed
- Main topics and decisions as bullet points

## Action Items
- Concrete next steps with owners if mentioned

## Key Takeaways
- Important conclusions or insights

Rules:
- Be concise but capture all important information
- Use bullet points, not paragraphs
- If the transcript is short or unclear, summarize what you can
- Do NOT add information that isn't in the transcript
- Keep each bullet point to 1-2 sentences max`;

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllMeetings(200);
      setMeetings(list);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Refresh list when a meeting is created elsewhere (e.g. after system audio capture stops)
  useEffect(() => {
    const handler = () => loadMeetings();
    window.addEventListener("meeting-created", handler);
    return () => window.removeEventListener("meeting-created", handler);
  }, [loadMeetings]);

  const loadMeeting = useCallback(async (id: string) => {
    try {
      const meeting = await getMeetingById(id);
      setCurrentMeeting(meeting);
      return meeting;
    } catch (err) {
      console.error("Failed to load meeting:", err);
      return null;
    }
  }, []);

  const createFromTranscript = useCallback(
    async (
      transcript: string,
      title?: string,
      durationSeconds?: number
    ): Promise<Meeting | null> => {
      setSaving(true);
      try {
        const meeting = await createMeeting({
          id: generateId(),
          title: title || `Meeting ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
          transcript,
          durationSeconds: durationSeconds ?? 0,
          status: "processing",
        });

        setMeetings((prev) => [meeting, ...prev]);
        return meeting;
      } catch (err) {
        console.error("Failed to create meeting:", err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const generateSummary = useCallback(
    async (meetingId: string): Promise<string | null> => {
      setGeneratingSummary(true);
      try {
        const meeting = await getMeetingById(meetingId);
        if (!meeting?.transcript) return null;

        const chunks: string[] = [];
        let streamComplete = false;

        const unlisten = await listen(
          "chat_stream_chunk",
          (event: { payload: string }) => {
            chunks.push(event.payload);
          }
        );
        const unlistenComplete = await listen("chat_stream_complete", () => {
          streamComplete = true;
        });

        await invoke("chat_stream_response", {
          userMessage: `Here is the meeting transcript to summarize:\n\n${meeting.transcript}`,
          systemPrompt: SUMMARY_SYSTEM_PROMPT,
          imageBase64: null,
          history: null,
        });

        while (!streamComplete) {
          await new Promise((r) => setTimeout(r, 50));
        }
        unlisten();
        unlistenComplete();

        const summary = chunks.join("");

        await updateMeeting(meetingId, { summary, status: "completed" });

        // Update local state
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === meetingId ? { ...m, summary, status: "completed" } : m
          )
        );
        if (currentMeeting?.id === meetingId) {
          setCurrentMeeting((prev) =>
            prev ? { ...prev, summary, status: "completed" } : prev
          );
        }

        return summary;
      } catch (err) {
        console.error("Failed to generate summary:", err);
        await updateMeeting(meetingId, { status: "completed" });
        return null;
      } finally {
        setGeneratingSummary(false);
      }
    },
    [currentMeeting?.id]
  );

  const updateNotes = useCallback(
    async (id: string, notes: string) => {
      try {
        await updateMeeting(id, { notes });
        setMeetings((prev) =>
          prev.map((m) => (m.id === id ? { ...m, notes } : m))
        );
        if (currentMeeting?.id === id) {
          setCurrentMeeting((prev) => (prev ? { ...prev, notes } : prev));
        }
      } catch (err) {
        console.error("Failed to update notes:", err);
      }
    },
    [currentMeeting?.id]
  );

  const updateTitle = useCallback(
    async (id: string, title: string) => {
      try {
        await updateMeeting(id, { title });
        setMeetings((prev) =>
          prev.map((m) => (m.id === id ? { ...m, title } : m))
        );
        if (currentMeeting?.id === id) {
          setCurrentMeeting((prev) => (prev ? { ...prev, title } : prev));
        }
      } catch (err) {
        console.error("Failed to update title:", err);
      }
    },
    [currentMeeting?.id]
  );

  const removeMeeting = useCallback(
    async (id: string) => {
      try {
        await dbDeleteMeeting(id);
        setMeetings((prev) => prev.filter((m) => m.id !== id));
        if (currentMeeting?.id === id) {
          setCurrentMeeting(null);
        }
      } catch (err) {
        console.error("Failed to delete meeting:", err);
      }
    },
    [currentMeeting?.id]
  );

  return {
    meetings,
    currentMeeting,
    loading,
    saving,
    generatingSummary,
    loadMeetings,
    loadMeeting,
    createFromTranscript,
    generateSummary,
    updateNotes,
    updateTitle,
    removeMeeting,
    setCurrentMeeting,
  };
}
