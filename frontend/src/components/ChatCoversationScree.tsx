 "use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShieldCheck,
  Paperclip,
  Send,
  Lock,
  MoreVertical,
  Loader2,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);

  const contact = { address: chatId, name: "Contact" };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    scrollToBottom();
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

  // Drop expired messages from UI
  useEffect(() => {
    updateMessages((prev) => prev.filter((message) => message.expirationTimestamp > now));
  }, [now]);

  useEffect(() => {
    updateMessages(() => []);
  }, [address, chatId]);

  // Initial sync + polling fallback
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

  // Real-time updates via MessageSent event
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
    if (!newMessage.trim() || !contact) return;
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

      // 1) Encrypt client-side
      const payload = encryptMessage(newMessage, me, other, expirationSeconds);

      // 2) Upload to IPFS
      const cid = await uploadEncryptedPayload(payload);

      // 3) Store CID on-chain
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-b border-border p-4 sticky top-0 z-20"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-success/50 flex items-center justify-center">
                <span className="text-sm font-semibold">
                  {contact?.name?.slice(0, 2).toUpperCase() || "??"}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center">
                <ShieldCheck className="w-3 h-3 text-success" />
              </div>
            </div>

            <div className="flex-1">
              <h2 className="font-semibold text-foreground">
                {contact?.name || contact?.address?.slice(0, 10) + "..."}
              </h2>
              <div className="flex items-center gap-1 text-xs text-success">
                <Lock className="w-3 h-3" />
                <span>ECIES encrypted</span>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </motion.header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {/* Encryption notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center"
        >
          <div className="bg-secondary/50 rounded-full px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3 text-primary" />
            Messages are end-to-end encrypted and stored on IPFS
          </div>
        </motion.div>

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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.28, ease: "easeOut" }}
              className={`flex ${
                message.sender === "me" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === "me"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "glass rounded-bl-sm"
                } ${isDisappearing ? "disappearing" : ""}`}
              >
                <p className="text-sm">{message.content}</p>
                <div
                  className={`flex items-center gap-2 text-xs mt-1 ${
                    message.sender === "me"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  <span>{message.time}</span>
                  {message.encrypted && <Lock className="w-2.5 h-2.5" />}
                  {showCountdown && (
                    <span className="px-2 py-0.5 rounded-full bg-black/20 text-[10px]">
                      {secondsLeft}s
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 text-[11px] ${
                    message.sender === "me"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  Timer: {timerText}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass border-t border-border p-4"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip className="w-5 h-5" />
          </Button>

          <Input
            placeholder="Type an encrypted message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="bg-secondary border-border h-11"
          />

          {/* Expiration selector */}
          <div className="flex gap-1">
            {(["30s", "1m", "5m", "1h"] as ExpirationOption[]).map((option) => (
              <motion.button
                key={option}
                type="button"
                onClick={() => setExpirationOption(option)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                animate={{
                  scale: expirationOption === option ? 1.04 : 1,
                  y: expirationOption === option ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 22, mass: 0.7 }}
                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                  expirationOption === option
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 ring-1 ring-primary/35"
                    : "border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                {option}
              </motion.button>
            ))}
          </div>

          <motion.div
            animate={
              isSending
                ? { scale: [1, 1.045, 1], opacity: [1, 0.88, 1] }
                : { scale: 1, opacity: 1 }
            }
            transition={
              isSending
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.25, ease: "easeOut" }
            }
          >
            <Button
              variant="wallet"
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || isSending}
              className="shrink-0 h-11 w-11 rounded-full"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChatConversationScreen;
