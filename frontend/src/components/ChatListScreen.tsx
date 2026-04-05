"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Shield, Settings, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import ChatItem from "./ChatItem";
import { getContacts } from "@/lib/contacts";

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  verified: boolean;
  avatar: string;
}

function contactToChat(c: { address: string; name: string }): Chat {
  const initials = c.name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || c.address.slice(2, 4).toUpperCase();
  return {
    id: c.address,
    name: c.name,
    lastMessage: "Tap to start encrypted chat",
    time: "",
    unread: 0,
    verified: true,
    avatar: initials || "??",
  };
}

const ChatListScreen = () => {
  const router = useRouter();
  const { address } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");

  const chats: Chat[] = useMemo(() => {
    if (!address) return [];
    return getContacts(address).map(contactToChat);
  }, [address]);

  const filteredChats = useMemo(
    () =>
      chats.filter(
        (chat) =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [chats, searchQuery]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-b border-border p-4 sticky top-0 z-20"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">ChatLock</h1>
            <div className="flex items-center gap-1 text-xs text-success">
              <Shield className="w-3 h-3" />
              <span>All messages encrypted</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/settings")}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border h-11"
          />
        </div>
      </motion.header>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredChats.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredChats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ChatItem
                  chat={chat}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p>No conversations found</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring" }}
        className="fixed bottom-6 right-6"
      >
        <Button
          variant="wallet"
          size="icon"
          className="w-14 h-14 rounded-full shadow-lg"
          onClick={() => router.push("/new-chat")}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>
    </div>
  );
};

export default ChatListScreen;
