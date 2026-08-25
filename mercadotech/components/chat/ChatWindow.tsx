"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { LoadingMessage } from "@/components/chat/LoadingMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

export interface ChatWindowProps {
  messages: ChatMessageType[];
  loading: boolean;
  onSend: (text: string) => void;
  emptyState?: ReactNode;
}

// Puro: compone la conversación y el input; no conoce el endpoint ni
// lib/ai/ — todo el estado y el fetch viven en useChat (la página los
// conecta).
export function ChatWindow({ messages, loading, onSend, emptyState }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-[65vh] flex-col rounded-lg border border-border">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          emptyState
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            {loading ? <LoadingMessage /> : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}
