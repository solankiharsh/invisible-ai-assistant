export interface Meeting {
  id: string;
  title: string;
  transcript: string;
  summary: string | null;
  notes: string;
  durationSeconds: number;
  participants: string | null;
  calendarEventId: string | null;
  status: "recording" | "processing" | "completed";
  createdAt: number;
  updatedAt: number;
}

export interface MeetingInput {
  id: string;
  title: string;
  transcript: string;
  summary?: string | null;
  notes?: string;
  durationSeconds?: number;
  participants?: string | null;
  calendarEventId?: string | null;
  status?: "recording" | "processing" | "completed";
}

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  htmlLink?: string;
  hangoutLink?: string;
}
