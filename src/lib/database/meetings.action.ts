import { getDatabase } from "./config";
import type { Meeting, MeetingInput } from "@/types/meetings";

interface DbMeeting {
  id: string;
  title: string;
  transcript: string;
  summary: string | null;
  notes: string;
  duration_seconds: number;
  participants: string | null;
  calendar_event_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function dbToMeeting(row: DbMeeting): Meeting {
  return {
    id: row.id,
    title: row.title,
    transcript: row.transcript,
    summary: row.summary,
    notes: row.notes,
    durationSeconds: row.duration_seconds,
    participants: row.participants,
    calendarEventId: row.calendar_event_id,
    status: row.status as Meeting["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMeeting(input: MeetingInput): Promise<Meeting> {
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `INSERT INTO meetings (id, title, transcript, summary, notes, duration_seconds, participants, calendar_event_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      input.id,
      input.title,
      input.transcript,
      input.summary ?? null,
      input.notes ?? "",
      input.durationSeconds ?? 0,
      input.participants ?? null,
      input.calendarEventId ?? null,
      input.status ?? "completed",
      now,
      now,
    ]
  );

  return {
    id: input.id,
    title: input.title,
    transcript: input.transcript,
    summary: input.summary ?? null,
    notes: input.notes ?? "",
    durationSeconds: input.durationSeconds ?? 0,
    participants: input.participants ?? null,
    calendarEventId: input.calendarEventId ?? null,
    status: input.status ?? "completed",
    createdAt: now,
    updatedAt: now,
  };
}

export async function getAllMeetings(limit = 100): Promise<Meeting[]> {
  const db = await getDatabase();
  const rows = await db.select<DbMeeting[]>(
    `SELECT * FROM meetings ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(dbToMeeting);
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const db = await getDatabase();
  const rows = await db.select<DbMeeting[]>(
    `SELECT * FROM meetings WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? dbToMeeting(rows[0]) : null;
}

export async function updateMeeting(
  id: string,
  updates: Partial<
    Pick<Meeting, "title" | "summary" | "notes" | "transcript" | "status" | "durationSeconds">
  >
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.title !== undefined) {
    sets.push(`title = $${idx++}`);
    values.push(updates.title);
  }
  if (updates.summary !== undefined) {
    sets.push(`summary = $${idx++}`);
    values.push(updates.summary);
  }
  if (updates.notes !== undefined) {
    sets.push(`notes = $${idx++}`);
    values.push(updates.notes);
  }
  if (updates.transcript !== undefined) {
    sets.push(`transcript = $${idx++}`);
    values.push(updates.transcript);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${idx++}`);
    values.push(updates.status);
  }
  if (updates.durationSeconds !== undefined) {
    sets.push(`duration_seconds = $${idx++}`);
    values.push(updates.durationSeconds);
  }

  if (sets.length === 0) return;

  sets.push(`updated_at = $${idx++}`);
  values.push(Date.now());
  values.push(id);

  await db.execute(
    `UPDATE meetings SET ${sets.join(", ")} WHERE id = $${idx}`,
    values
  );
}

export async function deleteMeeting(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM meetings WHERE id = $1`, [id]);
}
