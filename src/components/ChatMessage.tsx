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
            ? "bg-neonBlue/10 border border-neonBlue/30"
            : "bg-white/5 border border-white/10"
        )}
      >
        <p className={cn("font-mono", className)}>{content}</p>
      </div>
    </div>
  );
};

export default ChatMessage;