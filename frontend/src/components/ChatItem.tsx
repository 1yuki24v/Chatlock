"use client";

import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  verified: boolean;
  avatar: string;
}

interface ChatItemProps {
  chat: Chat;
  onClick: () => void;
  active?: boolean;
}

const ChatItem = ({ chat, onClick, active = false }: ChatItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-[26px] px-4 py-3 text-left transition-all duration-300 ease-out",
        active
          ? "bg-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.34)]"
          : "hover:bg-white/[0.045]"
      )}
    >
      {active && (
        <span className="absolute bottom-3 left-0 top-3 w-px rounded-full bg-[linear-gradient(180deg,#A855F7_0%,#7C3AED_45%,#22D3EE_100%)]" />
      )}

      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/[0.08] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            active
              ? "bg-[linear-gradient(160deg,rgba(168,85,247,0.35),rgba(34,211,238,0.22))]"
              : "bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]"
          )}
        >
          <span>{chat.avatar}</span>
          {chat.verified && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#0b0b0d] bg-[#101014]">
              <Shield className="h-2.5 w-2.5 text-[#8EF3D9]" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                {chat.name}
              </h3>
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
              {chat.time}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[13px] font-medium text-muted-foreground">
              {chat.lastMessage}
            </p>
            {chat.unread > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#A855F7_0%,#22D3EE_100%)] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_10px_22px_rgba(34,211,238,0.15)]">
                {chat.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default ChatItem;
