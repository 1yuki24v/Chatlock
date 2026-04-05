"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Key, Copy, Check, ArrowRight, User, Wallet, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useEncryption } from "@/hooks/useEncryption";
import { compressPublicKey } from "@/lib/encryption";

const IdentitySetupScreen = () => {
  const router = useRouter();
  const { address, isConnected, disconnect } = useWallet();
  const { encryptionKeys, isInitialized, isInitializing, initializeEncryption } = useEncryption();
  const [username, setUsername] = useState("");
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isConnected || !address) {
      router.push("/");
    }
  }, [isConnected, address, router]);

  const handleCopyKey = () => {
    if (encryptionKeys?.publicKey) {
      navigator.clipboard.writeText(encryptionKeys.publicKey);
      setCopied(true);
      toast({
        title: "Public key copied",
        description: "Share this with contacts for E2E encryption",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinue = async () => {
    if (step === 1 && username.trim()) {
      localStorage.setItem(`chatlock_username_${address}`, username);
      setStep(2);
      
      // Initialize encryption if not already done
      if (!isInitialized) {
        await initializeEncryption();
      }
    } else if (step === 2) {
      router.push("/chats");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!address) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-success/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Connected wallet badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono">{formatAddress(address)}</span>
            <button
              onClick={() => window.open(`https://etherscan.io/address/${address}`, "_blank")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`w-12 h-0.5 ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        <div className="glass-card p-8">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center mb-2">Create Your Identity</h2>
              <p className="text-muted-foreground text-center mb-8">
                Choose a display name for your secure profile
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Display Name</label>
                  <Input
                    placeholder="Enter your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-secondary border-border h-12"
                  />
                </div>

                <Button
                  variant="wallet"
                  size="lg"
                  onClick={handleContinue}
                  disabled={!username.trim()}
                  className="w-full"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center animate-pulse-glow">
                  <Key className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center mb-2">Encryption Keys</h2>
              <p className="text-muted-foreground text-center mb-8">
                Your keys for end-to-end encrypted messaging
              </p>

              {isInitializing ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">Generating encryption keys...</p>
                  <p className="text-xs text-muted-foreground mt-1">Please sign the request in MetaMask</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Public Key Display */}
                  <div className="glass p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Encryption Public Key</span>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          ECIES
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-success text-xs">
                        <Shield className="w-3 h-3" />
                        <span>Verified</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/50 rounded-lg px-3 py-2 text-xs font-mono text-foreground truncate">
                        {encryptionKeys?.publicKey
                          ? compressPublicKey(encryptionKeys.publicKey).slice(0, 40) + "..."
                          : "Generating..."}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyKey}
                        disabled={!encryptionKeys}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="glass p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Wallet Address</span>
                    </div>
                    <code className="block bg-background/50 rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                      {address}
                    </code>
                  </div>

                  {/* Security Info */}
                  <div className="bg-success/10 border border-success/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-success">Keys Derived from Wallet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your encryption keys are deterministically derived from your wallet signature
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="wallet"
                    size="lg"
                    onClick={handleContinue}
                    disabled={!isInitialized}
                    className="w-full"
                  >
                    Start Messaging
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Security note */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Secured by eth-crypto
          </p>
          <button
            onClick={() => disconnect()}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Disconnect wallet
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default IdentitySetupScreen;
