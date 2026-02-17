import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button, ScrollArea, Markdown } from "@/components";
import { semanticSearch } from "@/lib";
import { Loader2, SendIcon } from "lucide-react";

const RAG_SYSTEM_PREFIX = `You are a helpful assistant with access to the user's knowledge base. Use the following context when relevant to answer the question. If the context doesn't contain enough information, say so.`;

export const KnowledgeChat = ({
  itemIdFilter,
  onBack,
}: {
  itemIdFilter?: string;
  onBack?: () => void;
}) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamBuffer("");

    try {
      const chunks = await semanticSearch(text, 8, itemIdFilter);
      const context = chunks
        .map((c) => `[${c.title ?? "Item"}]: ${c.chunkText}`)
        .join("\n\n---\n\n");
      const systemPrompt = context
        ? `${RAG_SYSTEM_PREFIX}\n\n## Context\n\n${context}`
        : RAG_SYSTEM_PREFIX + "\n\n(No relevant context found in the knowledge base.)";

      let streamComplete = false;
      const streamChunks: string[] = [];

      const unlisten = await listen("chat_stream_chunk", (event: { payload: string }) => {
        streamChunks.push(event.payload);
      });
      const unlistenComplete = await listen("chat_stream_complete", () => {
        streamComplete = true;
      });

      await invoke("chat_stream_response", {
        userMessage: text,
        systemPrompt,
        imageBase64: null,
        history: null,
      });

      while (!streamComplete) {
        await new Promise((r) => setTimeout(r, 50));
        setStreamBuffer(streamChunks.join(""));
      }
      unlisten();
      unlistenComplete();

      const fullResponse = streamChunks.join("");
      setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setStreaming(false);
      setStreamBuffer("");
    }
  }, [input, streaming, itemIdFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {onBack && (
        <Button variant="ghost" size="sm" className="self-start mb-2" onClick={onBack}>
          Back to Knowledge
        </Button>
      )}
      <ScrollArea ref={scrollRef} className="flex-1 border rounded-lg p-4 mb-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask anything about your knowledge base. Results are grounded in your
              saved conversations.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "bg-primary/10 border-l-4 border-primary pl-3 py-2 rounded"
                  : "bg-muted/50 pl-3 py-2 rounded"
              }
            >
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                {msg.role === "user" ? "You" : "Assistant"}
              </span>
              {msg.role === "assistant" ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
          ))}
          {streaming && streamBuffer && (
            <div className="bg-muted/50 pl-3 py-2 rounded">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Assistant
              </span>
              <Markdown>{streamBuffer}</Markdown>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about your knowledge base..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          disabled={streaming}
        />
        <Button onClick={sendMessage} disabled={streaming || !input.trim()}>
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
