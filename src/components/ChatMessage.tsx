import React from "react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  content: string;
  isBot?: boolean;
  className?: string;
}

const ChatMessage = ({ content, isBot = false, className }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "mb-4 animate-fadeIn opacity-0",
        isBot ? "mr-auto" : "ml-auto",
        className
      )}
    >
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%]",
          isBot
            ? "bg-neonBlue/10 text-neonBlue border border-neonBlue/30"
            : "bg-white/5 text-white border border-white/10"
        )}
      >
        <p className="font-mono text-sm">{content}</p>
      </div>
    </div>
  );
};

export default ChatMessage;