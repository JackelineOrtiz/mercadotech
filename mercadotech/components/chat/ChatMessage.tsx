import { cn } from "@/lib/utils";
import { SourcesList } from "@/components/chat/SourcesList";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

export interface ChatMessageProps {
  message: ChatMessageType;
}

// Puro: recibe el mensaje ya resuelto, no sabe de dónde vino.
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.sources && message.sources.length > 0 ? (
          <SourcesList sources={message.sources} className="mt-2" />
        ) : null}
      </div>
    </div>
  );
}
