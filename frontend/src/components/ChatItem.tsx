"use client";

import { Shield } from "lucide-react";

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
}

const ChatItem = ({ chat, onClick }: ChatItemProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 hover:bg-secondary/50 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-primary-foreground">
            {chat.avatar}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{chat.name}</h3>
              {chat.verified && (
                <Shield className="w-4 h-4 text-success shrink-0" />
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">
              {chat.time}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
            {chat.unread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ml-2">
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






