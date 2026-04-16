"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Info,
  Loader2,
  Lock,
  Paperclip,
  Phone,
  Search,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import {
  Address,
  EncryptedPayload,
  decryptMessage,
  encryptMessage,
} from "@/utils/encryption";
import {
  uploadEncryptedPayload,
  fetchEncryptedPayload,
} from "@/utils/ipfs";
import {
  fetchMessagesForUser,
  type OnChainMessage,
  sendMessageOnChain,
  watchNewMessages,
} from "@/utils/blockchain";
import ChatItem from "@/components/ChatItem";
import { getContacts } from "@/lib/contacts";
import { cn } from "@/lib/utils";

type ExpirationOption = "30s" | "1m" | "5m" | "1h";

const EXPIRATION_SECONDS: Record<ExpirationOption, number> = {
  "30s": 30,
  "1m": 60,
  "5m": 5 * 60,
  "1h": 60 * 60,
};

const POLLING_INTERVAL_MS = 8000;

interface Message {
  id: string;
  content: string;
  encryptedPayload?: EncryptedPayload;
  cid?: string;
  time: string;
  createdAt: number;
  sender: "me" | "them";
  type: "text" | "file" | "image";
  encrypted: boolean;
  expirationTimestamp: number;
}

interface SidebarContact {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
  verified: boolean;
  avatar: string;
}

interface ChatConversationScreenProps {
  chatId: string;
}

const isValidAddress = (value: string): value is Address => {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
};

const normalizeAddress = (value: string) => value.toLowerCase();

const isSameAddress = (left: string, right: string) => {
  return normalizeAddress(left) === normalizeAddress(right);
};

const isConversationMessage = (
  sender: Address,
  receiver: Address,
  me: Address,
  other: Address
) => {
  return (
    (isSameAddress(sender, me) && isSameAddress(receiver, other)) ||
    (isSameAddress(sender, other) && isSameAddress(receiver, me))
  );
};

const getMessageId = (sender: Address, receiver: Address, cid: string) => {
  return `${normalizeAddress(sender)}:${normalizeAddress(receiver)}:${cid}`;
};

const formatMessageTime = (timestampMs: number) => {
  return new Date(timestampMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const getAvatarLabel = (name: string, address: string) => {
  const initials = name
    .split(/\s+/)
    .map((segment) => segment[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || address.slice(2, 4).toUpperCase();
};

const mergeMessages = (current: Message[], incoming: Message[]) => {
  const nowMs = Date.now();
  const byId = new Map<string, Message>();

  for (const message of current) {
    if (message.expirationTimestamp > nowMs) {
      byId.set(message.id, message);
    }
  }

  for (const message of incoming) {
    if (message.expirationTimestamp > nowMs) {
      byId.set(message.id, message);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return left.id.localeCompare(right.id);
    }
    return left.createdAt - right.createdAt;
  });
};

async function hydrateOnChainMessage(
  message: OnChainMessage,
  me: Address
): Promise<Message | null> {
  const payload = await fetchEncryptedPayload(message.cid);
  const createdAt = Number(message.timestamp) * 1000;
  const expirationTimestamp = Math.min(
    Number(message.expirationTimestamp) * 1000,
    Number(payload.expiration)
  );

  if (expirationTimestamp <= Date.now()) {
    return null;
  }

  const plaintext = decryptMessage(payload, message.sender, message.receiver);

  return {
    id: getMessageId(message.sender, message.receiver, message.cid),
    content: plaintext,
    encryptedPayload: payload,
    cid: message.cid,
    time: formatMessageTime(createdAt),
    createdAt,
    sender: isSameAddress(message.sender, me) ? "me" : "them",
    type: "text",
    encrypted: true,
    expirationTimestamp,
  };
}

async function hydrateEventMessage(
  sender: Address,
  receiver: Address,
  cid: string,
  me: Address
): Promise<Message | null> {
  const payload = await fetchEncryptedPayload(cid);
  const expirationTimestamp = Number(payload.expiration);

  if (expirationTimestamp <= Date.now()) {
    return null;
  }

  const createdAt = Number(payload.timestamp);
  const plaintext = decryptMessage(payload, sender, receiver);

  return {
    id: getMessageId(sender, receiver, cid),
    content: plaintext,
    encryptedPayload: payload,
    cid,
    time: formatMessageTime(createdAt),
    createdAt,
    sender: isSameAddress(sender, me) ? "me" : "them",
    type: "text",
    encrypted: true,
    expirationTimestamp,
  };
}

const ChatConversationScreen = ({ chatId }: ChatConversationScreenProps) => {
  const router = useRouter();
  const { address } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [expirationOption, setExpirationOption] = useState<ExpirationOption>("5m");
  const [now, setNow] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  };

  const sidebarContacts = useMemo<SidebarContact[]>(() => {
    const storedContacts = address ? getContacts(address) : [];
    const activeAlreadyStored =
      isValidAddress(chatId) &&
      storedContacts.some((contact) => isSameAddress(contact.address, chatId));

    const combinedContacts =
      isValidAddress(chatId) && !activeAlreadyStored
        ? [...storedContacts, { address: chatId, name: formatAddress(chatId) }]
        : storedContacts;

    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    return combinedContacts.map((contact) => {
      const active = isValidAddress(chatId) && isSameAddress(contact.address, chatId);

      return {
        id: contact.address,
        name: contact.name || formatAddress(contact.address),
        lastMessage: active
          ? latestMessage?.content || "End-to-end encrypted conversation"
          : "Encrypted conversation",
        time: active ? latestMessage?.time || "Now" : "",
        unread: 0,
        verified: true,
        avatar: getAvatarLabel(contact.name || formatAddress(contact.address), contact.address),
      };
    });
  }, [address, chatId, messages]);

  const filteredContacts = useMemo(
    () =>
      sidebarContacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery, sidebarContacts]
  );

  const activeContact = useMemo<SidebarContact>(() => {
    const fallbackName = isValidAddress(chatId) ? formatAddress(chatId) : "Conversation";
    return (
      sidebarContacts.find((contact) => isSameAddress(contact.id, chatId)) || {
        id: chatId,
        name: fallbackName,
        lastMessage: "End-to-end encrypted conversation",
        time: "",
        unread: 0,
        verified: true,
        avatar: getAvatarLabel(fallbackName, isValidAddress(chatId) ? chatId : "0x00"),
      }
    );
  }, [chatId, sidebarContacts]);

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const contactSubtitle = latestMessage
    ? "Secure channel active"
    : "End-to-end encrypted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    updateMessages((prev) => prev.filter((message) => message.expirationTimestamp > now));
  }, [now]);

  useEffect(() => {
    updateMessages(() => []);
  }, [address, chatId]);

  useEffect(() => {
    if (!address || !isValidAddress(chatId)) return;

    const me = address as Address;
    const other = chatId as Address;
    let cancelled = false;

    const syncMessages = async (source: "initial" | "poll") => {
      try {
        const onChainMessages = await fetchMessagesForUser(me);
        const relevantMessages = onChainMessages.filter((message) =>
          isConversationMessage(message.sender, message.receiver, me, other)
        );
        const knownMessageIds = new Set(messagesRef.current.map((message) => message.id));
        const missingMessages = relevantMessages.filter(
          (message) =>
            !knownMessageIds.has(getMessageId(message.sender, message.receiver, message.cid))
        );

        console.debug("[chatlock:conversation] Chain sync", {
          source,
          wallet: me,
          peer: other,
          totalFetched: onChainMessages.length,
          relevant: relevantMessages.length,
          missing: missingMessages.length,
        });

        if (missingMessages.length === 0) {
          return;
        }

        const hydratedMessages = (
          await Promise.all(
            missingMessages.map(async (message) => {
              try {
                return await hydrateOnChainMessage(message, me);
              } catch (error) {
                console.error("Failed to hydrate on-chain message", {
                  cid: message.cid,
                  error,
                });
                return null;
              }
            })
          )
        ).filter((message): message is Message => message !== null);

        if (cancelled || hydratedMessages.length === 0) {
          return;
        }

        updateMessages((prev) => mergeMessages(prev, hydratedMessages));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync messages from chain", error);
        }
      }
    };

    void syncMessages("initial");
    const intervalId = window.setInterval(() => {
      void syncMessages("poll");
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [address, chatId]);

  useEffect(() => {
    if (!address || !isValidAddress(chatId)) return;

    const me = address as Address;
    const other = chatId as Address;

    const unwatch = watchNewMessages(async ({ sender, receiver, cid, transactionHash }) => {
      if (!isConversationMessage(sender, receiver, me, other)) {
        return;
      }

      console.debug("[chatlock:conversation] Event matched active conversation", {
        sender,
        receiver,
        cid,
        transactionHash,
      });

      try {
        const nextMessage = await hydrateEventMessage(sender, receiver, cid, me);
        if (!nextMessage) {
          return;
        }

        updateMessages((prev) => mergeMessages(prev, [nextMessage]));
      } catch (error) {
        console.error("Failed to handle incoming MessageSent event. Polling will retry.", error);
      }
    });

    return () => {
      if (typeof unwatch === "function") {
        unwatch();
      }
    };
  }, [address, chatId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet before sending messages.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidAddress(chatId)) {
      toast({
        title: "Invalid recipient",
        description: "Chat ID is not a valid Ethereum address.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const me = address as Address;
      const other = chatId as Address;
      const expirationSeconds = EXPIRATION_SECONDS[expirationOption];
      const payload = encryptMessage(newMessage, me, other, expirationSeconds);
      const cid = await uploadEncryptedPayload(payload);

      await sendMessageOnChain(other, cid, payload.expiration);

      const message: Message = {
        id: getMessageId(me, other, cid),
        content: newMessage,
        encryptedPayload: payload,
        cid,
        time: formatMessageTime(payload.timestamp),
        createdAt: payload.timestamp,
        sender: "me",
        type: "text",
        encrypted: true,
        expirationTimestamp: payload.expiration,
      };

      updateMessages((prev) => mergeMessages(prev, [message]));
      setNewMessage("");

      toast({
        title: "Message sent",
        description: "Encrypted, stored on IPFS, and recorded on Ethereum.",
      });
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "Send failed",
        description: "Could not send the message. Check your wallet and network.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-[1480px] flex-col p-3 sm:p-4 lg:p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-[#A855F7]/10 blur-[140px]" />
          <div className="absolute bottom-[10%] right-[8%] h-80 w-80 rounded-full bg-[#22D3EE]/8 blur-[160px]" />
        </div>

        <div className="relative overflow-hidden rounded-[34px] border border-white/[0.06] bg-[#09090b]/90 shadow-[0_32px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl lg:grid lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="hidden lg:flex lg:flex-col lg:border-r lg:border-white/[0.06]">
            <div className="px-4 pb-4 pt-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Messages
                  </p>
                  <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                    ChatLock
                  </h1>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/chats")}
                  className="text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 pl-11"
                />
              </div>
            </div>

            <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
              {filteredContacts.map((contact, index) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, type: "spring", stiffness: 180, damping: 20 }}
                >
                  <ChatItem
                    chat={contact}
                    active={isSameAddress(contact.id, activeContact.id)}
                    onClick={() => router.push(`/chat/${contact.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[calc(100vh-1.5rem)] flex-col lg:min-h-0">
            <motion.header
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="glass mx-3 mt-3 flex items-center justify-between rounded-[28px] px-4 py-4 sm:mx-4 lg:mx-5 lg:mt-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/chats")}
                  className="lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/[0.08] bg-[linear-gradient(155deg,rgba(168,85,247,0.32),rgba(34,211,238,0.16))] text-sm font-semibold text-white shadow-[0_20px_46px_rgba(0,0,0,0.34)]">
                  <span>{activeContact.avatar}</span>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#09090b] bg-[#101014]">
                    <ShieldCheck className="h-2.5 w-2.5 text-[#8EF3D9]" />
                  </span>
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-foreground">
                    {activeContact.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#22D3EE]" />
                    <span>{contactSubtitle}</span>
                    <span className="text-white/20">&middot;</span>
                    <span>{formatAddress(activeContact.id)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                  <Info className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.header>

            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 lg:px-5">
              <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mb-5 self-center rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                >
                  Messages are encrypted before leaving your device
                </motion.div>

                {messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="max-w-md rounded-[30px] border border-white/[0.06] bg-white/[0.03] px-8 py-10 text-center shadow-[0_28px_60px_rgba(0,0,0,0.35)]">
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(155deg,rgba(168,85,247,0.18),rgba(34,211,238,0.12))] text-white">
                        <Lock className="h-7 w-7" />
                      </div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                        Start the conversation
                      </h3>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Send a message and ChatLock will encrypt it locally, store the payload on
                        IPFS, and write only the CID to the blockchain.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map((message, index) => {
                      const timeUntilExpireMs = message.expirationTimestamp - now;
                      const secondsLeft = Math.max(0, Math.floor(timeUntilExpireMs / 1000));
                      const showCountdown = timeUntilExpireMs > 0 && secondsLeft <= 10;
                      const isDisappearing = timeUntilExpireMs > 0 && timeUntilExpireMs <= 5000;
                      const minutesPart = Math.floor(secondsLeft / 60)
                        .toString()
                        .padStart(2, "0");
                      const secondsPart = (secondsLeft % 60).toString().padStart(2, "0");
                      const timerText = `${minutesPart}:${secondsPart}`;

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 12, scale: 0.99 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            delay: index * 0.03,
                            type: "spring",
                            stiffness: 220,
                            damping: 22,
                          }}
                          className={cn(
                            "flex",
                            message.sender === "me" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[min(82vw,35rem)] rounded-[22px] px-4 py-3.5 shadow-[0_22px_44px_rgba(0,0,0,0.3)] sm:px-5",
                              message.sender === "me"
                                ? "bg-[#121212] text-white"
                                : "bg-[#1b1b1f] text-[#F3F4F6]",
                              isDisappearing ? "disappearing" : ""
                            )}
                          >
                            <p className="text-[15px] leading-7">{message.content}</p>

                            <div
                              className={cn(
                                "mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium",
                                message.sender === "me"
                                  ? "text-white/45"
                                  : "text-white/38"
                              )}
                            >
                              <span>{message.time}</span>
                              {message.encrypted && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-current/50" />
                                  <span className="inline-flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    <span>Encrypted</span>
                                  </span>
                                </>
                              )}
                              <span className="h-1 w-1 rounded-full bg-current/50" />
                              <span>Auto-delete {timerText}</span>
                              {showCountdown && (
                                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/72">
                                  {secondsLeft}s left
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5"
            >
              <div className="glass-card rounded-[30px] p-2.5">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full text-muted-foreground"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>

                  <div className="min-w-0 flex-1">
                    <Input
                      placeholder="Write a secure message"
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-12 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                    />

                    <div className="mt-2 flex flex-wrap gap-2 px-2 pb-1">
                      {(["30s", "1m", "5m", "1h"] as ExpirationOption[]).map((option) => (
                        <motion.button
                          key={option}
                          type="button"
                          onClick={() => setExpirationOption(option)}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 300, damping: 22 }}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] transition-colors",
                            expirationOption === option
                              ? "bg-[linear-gradient(135deg,rgba(168,85,247,0.24),rgba(34,211,238,0.22))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                              : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                          )}
                        >
                          {option}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  >
                    <Button
                      variant="wallet"
                      size="icon"
                      onClick={() => void handleSend()}
                      disabled={!newMessage.trim() || isSending}
                      className="h-12 w-12 rounded-full"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ChatConversationScreen;
