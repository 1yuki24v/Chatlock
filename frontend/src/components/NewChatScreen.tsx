"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, QrCode, Key, UserPlus, Copy, Check, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { useEncryption } from "@/hooks/useEncryption";
import { compressPublicKey } from "@/lib/encryption";
import {
  addContact as saveContact,
  isOwnAddress,
  isValidEthAddress,
} from "@/lib/contacts";

const NewChatScreen = () => {
  const router = useRouter();
  const { address } = useAccount();
  const { encryptionKeys, isInitialized } = useEncryption();
  const [activeTab, setActiveTab] = useState<"key" | "qr">("key");
  const [walletAddress, setWalletAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const myPublicKey = encryptionKeys?.publicKey || "";
  const compressedKey = myPublicKey ? compressPublicKey(myPublicKey) : "";

  const handleCopyKey = () => {
    if (myPublicKey) {
      navigator.clipboard.writeText(myPublicKey);
      setCopied(true);
      toast({
        title: "Public key copied",
        description: "Share this with your contact for E2E encryption",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddContact = async () => {
    const raw = walletAddress.trim();
    if (!raw) return;
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Connect your wallet to add contacts.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEthAddress(raw)) {
      toast({
        title: "Invalid address",
        description: "Enter a valid Ethereum address (0x followed by 40 hex characters).",
        variant: "destructive",
      });
      return;
    }

    if (isOwnAddress(address, raw)) {
      toast({
        title: "Cannot add yourself",
        description: "Use another wallet's address to start a chat.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      saveContact(address, {
        address: raw,
        name: contactName.trim() || `${raw.slice(0, 6)}...${raw.slice(-4)}`,
      });
      toast({
        title: "Contact added",
        description: "You can start a chat from the list.",
      });
      router.push("/chats");
    } catch (e) {
      toast({
        title: "Failed to add contact",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Initializing encryption...</p>
        </div>
      </div>
    );
  }

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
          <div>
            <h1 className="text-xl font-bold text-foreground">New Chat</h1>
            <p className="text-xs text-muted-foreground">Add a contact securely</p>
          </div>
        </div>
      </motion.header>

      <div className="flex-1 p-4 space-y-6">
        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 p-1 bg-secondary rounded-xl"
        >
          <button
            onClick={() => setActiveTab("key")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
              activeTab === "key"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Key className="w-4 h-4" />
            <span className="text-sm font-medium">Public Key</span>
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
              activeTab === "qr"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="text-sm font-medium">QR Code</span>
          </button>
        </motion.div>

        {activeTab === "key" ? (
          <motion.div
            key="key-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Your Key */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Your Public Key</span>
                  <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                    eth-crypto
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCopyKey}>
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <code className="block bg-background/50 rounded-lg p-3 text-xs font-mono text-muted-foreground break-all">
                {myPublicKey || "Generating..."}
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Compressed: {compressedKey.slice(0, 20)}...
              </p>
            </div>

            {/* Add Contact */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">Add Contact</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Contact Name (optional)
                  </label>
                  <Input
                    placeholder="Enter a name..."
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="bg-secondary border-border h-12"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Contact&apos;s wallet address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="bg-secondary border-border h-12 font-mono text-sm"
                  />
                </div>

                <Button
                  variant="wallet"
                  size="lg"
                  onClick={handleAddContact}
                  disabled={!walletAddress.trim() || isAdding}
                  className="w-full"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Verify & Add Contact
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="qr-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* QR Code Display */}
            <div className="glass-card p-6 flex flex-col items-center">
              <p className="text-sm text-muted-foreground mb-4">Your QR Code</p>
              <div className="w-48 h-48 bg-foreground rounded-xl flex items-center justify-center p-4">
                <div className="w-full h-full bg-background rounded-lg flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Let your contact scan this to add you
              </p>
            </div>

            {/* Scan QR */}
            <Button variant="outline" size="lg" className="w-full">
              <QrCode className="w-4 h-4" />
              Scan Contact's QR Code
            </Button>
          </motion.div>
        )}

        {/* Security note */}
        <div className="bg-success/10 border border-success/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-success">End-to-End Encryption</p>
              <p className="text-xs text-muted-foreground mt-1">
                Messages are encrypted with ECIES using eth-crypto. Only you and your contact can read them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatScreen;
