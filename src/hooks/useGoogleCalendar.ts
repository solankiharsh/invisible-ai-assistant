import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { safeLocalStorage } from "@/lib";
import type {
  GoogleCalendarTokens,
  GoogleCalendarEvent,
} from "@/types/meetings";

const STORAGE_KEYS = {
  GCAL_CLIENT_ID: "gcal_client_id",
  GCAL_CLIENT_SECRET: "gcal_client_secret",
  GCAL_TOKENS: "gcal_tokens",
};

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export function useGoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientIdState] = useState(
    () => safeLocalStorage.getItem(STORAGE_KEYS.GCAL_CLIENT_ID) || ""
  );
  const [clientSecret, setClientSecretState] = useState(
    () => safeLocalStorage.getItem(STORAGE_KEYS.GCAL_CLIENT_SECRET) || ""
  );
  const tokensRef = useRef<GoogleCalendarTokens | null>(null);

  // Load saved tokens on mount
  useEffect(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEYS.GCAL_TOKENS);
    if (saved) {
      try {
        const tokens: GoogleCalendarTokens = JSON.parse(saved);
        tokensRef.current = tokens;
        setConnected(true);
      } catch {
        setConnected(false);
      }
    }
  }, []);

  const setClientId = useCallback((id: string) => {
    setClientIdState(id);
    safeLocalStorage.setItem(STORAGE_KEYS.GCAL_CLIENT_ID, id);
  }, []);

  const setClientSecret = useCallback((secret: string) => {
    setClientSecretState(secret);
    safeLocalStorage.setItem(STORAGE_KEYS.GCAL_CLIENT_SECRET, secret);
  }, []);

  const saveTokens = useCallback((tokens: GoogleCalendarTokens) => {
    tokensRef.current = tokens;
    safeLocalStorage.setItem(STORAGE_KEYS.GCAL_TOKENS, JSON.stringify(tokens));
    setConnected(true);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const tokens = tokensRef.current;
    if (!tokens?.refreshToken || !clientId || !clientSecret) return null;

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      });

      const resp = await tauriFetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await resp.json();
      if (data.access_token) {
        const updated: GoogleCalendarTokens = {
          accessToken: data.access_token,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        };
        saveTokens(updated);
        return data.access_token;
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
    return null;
  }, [clientId, clientSecret, saveTokens]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const tokens = tokensRef.current;
    if (!tokens) return null;
    if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
    return refreshAccessToken();
  }, [refreshAccessToken]);

  const connect = useCallback(async () => {
    if (!clientId || !clientSecret) {
      setError("Enter your Google Client ID and Client Secret first.");
      return;
    }
    setConnecting(true);
    setError(null);

    try {
      const result: { code: string; redirect_uri: string } = await invoke(
        "google_oauth_start",
        { clientId, scopes: SCOPES }
      );

      // Exchange code for tokens
      const body = new URLSearchParams({
        code: result.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: result.redirect_uri,
        grant_type: "authorization_code",
      });

      const resp = await tauriFetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await resp.json();

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      saveTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      });

      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [clientId, clientSecret, saveTokens]);

  const disconnect = useCallback(() => {
    tokensRef.current = null;
    safeLocalStorage.removeItem(STORAGE_KEYS.GCAL_TOKENS);
    setConnected(false);
    setEvents([]);
    setError(null);
  }, []);

  const fetchEvents = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      setError("Not connected. Please sign in first.");
      return;
    }

    setLoadingEvents(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const params = new URLSearchParams({
        timeMin: now,
        maxResults: "15",
        singleEvents: "true",
        orderBy: "startTime",
      });

      const resp = await tauriFetch(`${EVENTS_URL}?${params}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();

      if (data.error) {
        if (data.error.code === 401) {
          // Token expired, try refresh
          const newToken = await refreshAccessToken();
          if (newToken) {
            const retryResp = await tauriFetch(`${EVENTS_URL}?${params}`, {
              method: "GET",
              headers: { Authorization: `Bearer ${newToken}` },
            });
            const retryData = await retryResp.json();
            setEvents(retryData.items ?? []);
            return;
          }
          disconnect();
          setError("Session expired. Please reconnect.");
          return;
        }
        throw new Error(data.error.message || "Failed to fetch events");
      }

      setEvents(data.items ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoadingEvents(false);
    }
  }, [getValidToken, refreshAccessToken, disconnect]);

  // Auto-fetch upcoming events when connected (no manual sync/refresh needed)
  useEffect(() => {
    if (!connected) return;
    fetchEvents();
  }, [connected, fetchEvents]);

  return {
    connected,
    connecting,
    events,
    loadingEvents,
    error,
    clientId,
    clientSecret,
    setClientId,
    setClientSecret,
    connect,
    disconnect,
    fetchEvents,
  };
}
