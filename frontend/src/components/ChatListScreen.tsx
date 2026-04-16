"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
} from "lucide-react";
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

function contactToChat(contact: { address: string; name: string }): Chat {
  const initials =
    contact.name
      .split(/\s+/)
      .map((segment) => segment[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || contact.address.slice(2, 4).toUpperCase();

  return {
    id: contact.address,
    name: contact.name,
    lastMessage: "Encrypted conversation ready",
    time: "Now",
    unread: 0,
    verified: true,
    avatar: initials,
  };
}

function formatAddress(address?: string) {
  if (!address) return "No wallet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  const previewChat = filteredChats[0] ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-[1480px] flex-col p-3 sm:p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-[#A855F7]/10 blur-[140px]" />
          <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-[#22D3EE]/8 blur-[160px]" />
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-white/[0.06] bg-[#09090b]/90 shadow-[0_32px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl lg:grid lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex flex-col lg:border-r lg:border-white/[0.06]">
            <div className="px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Secure messaging
                  </p>
                  <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
                    ChatLock
                  </h1>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#22D3EE]" />
                    <span>{formatAddress(address)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/settings")}
                    className="text-muted-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="wallet"
                    size="icon"
                    onClick={() => router.push("/new-chat")}
                    className="h-11 w-11 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts or addresses"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 pl-11"
                />
              </div>
            </div>

            <div className="px-3 pb-4 sm:px-4">
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Conversations
                </p>
                <span className="text-xs text-muted-foreground">
                  {filteredChats.length}
                </span>
              </div>

              <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto pb-2">
                {filteredChats.length > 0 ? (
                  filteredChats.map((chat, index) => (
                    <motion.div
                      key={chat.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, type: "spring", stiffness: 180, damping: 20 }}
                    >
                      <ChatItem
                        chat={chat}
                        active={previewChat?.id === chat.id}
                        onClick={() => router.push(`/chat/${chat.id}`)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="glass-card rounded-[28px] px-6 py-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04]">
                      <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">
                      No conversations yet
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add a contact to start a calm, encrypted conversation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="hidden lg:flex lg:flex-col lg:justify-between lg:p-8">
            <div className="glass flex items-center justify-between rounded-[28px] px-6 py-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Workspace
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">
                  Premium secure threads
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 text-[#22D3EE]" />
                <span>Encrypted by default</span>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-10 text-center">
              {previewChat ? (
                <>
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/[0.08] bg-[linear-gradient(155deg,rgba(168,85,247,0.32),rgba(34,211,238,0.18))] text-2xl font-semibold text-white shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
                    {previewChat.avatar}
                  </div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                    Ready to open
                  </p>
                  <h3 className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
                    {previewChat.name}
                  </h3>
                  <p className="mt-4 max-w-xl text-base text-muted-foreground">
                    Open a thread to view on-chain message metadata, decrypt payloads from IPFS,
                    and continue the conversation in real time.
                  </p>

                  <div className="mt-10 grid w-full max-w-xl gap-4 md:grid-cols-2">
                    <div className="glass-card rounded-[28px] p-5 text-left">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Contact
                      </p>
                      <p className="mt-3 text-lg font-semibold text-foreground">
                        {previewChat.name}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{previewChat.id}</p>
                    </div>
                    <div className="glass-card rounded-[28px] p-5 text-left">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Latest preview
                      </p>
                      <p className="mt-3 text-sm font-medium text-foreground">
                        {previewChat.lastMessage}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Refined, quiet, and end-to-end encrypted.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="wallet"
                    size="lg"
                    onClick={() => router.push(`/chat/${previewChat.id}`)}
                    className="mt-10 min-w-56 rounded-full"
                  >
                    Open Conversation
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/[0.08] bg-white/[0.03] text-white shadow-[0_24px_50px_rgba(0,0,0,0.3)]">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
                    Quiet by design
                  </h3>
                  <p className="mt-4 max-w-xl text-base text-muted-foreground">
                    Your contact list lives in the sidebar. Add someone new, then step into a
                    conversation with a focused, minimal interface built for secure messaging.
                  </p>
                  <Button
                    variant="wallet"
                    size="lg"
                    onClick={() => router.push("/new-chat")}
                    className="mt-10 min-w-56 rounded-full"
                  >
                    Add First Contact
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ChatListScreen;
