"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Key, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useEffect } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";

const FEATURES = [
  { icon: Shield, label: "End-to-End Encrypted" },
  { icon: Key, label: "You Own the Keys" },
  { icon: Lock, label: "Zero Trust Security" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { connect, isConnecting, isConnected, address, verifyOwnership } =
    useWallet();

  useEffect(() => {
    if (isConnected && address) {
      router.push("/setup");
    }
  }, [isConnected, address, router]);

  const handleConnectWallet = async () => {
    const connectedAddress = await connect();
    if (!connectedAddress) return;

    const verified = await verifyOwnership();
    if (verified) router.push("/setup");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/10 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/10 blur-3xl rounded-full" />
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl text-center"
      >
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* Inner logo */}
            <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-xl">
              <Lock className="w-10 h-10 text-white" />
            </div>

            {/* Rotating gradient frame */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-primary/40 via-emerald-400/40 to-primary/40 blur-[1px]"
            />

            {/* Static outer border */}
            <div className="absolute -inset-4 rounded-3xl border border-primary/20" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-gray-900 dark:text-gray-100">
          ChatLock
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground mb-12">
          A decentralized, end-to-end encrypted messaging platform
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {FEATURES.map(({ icon: Icon, label }, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="rounded-xl border border-border bg-card px-4 py-5 flex flex-col items-center gap-2 shadow-sm"
            >
              <Icon className="w-6 h-6 text-primary" />
              <span className="text-sm text-muted-foreground text-center">
                {label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-sm">
            <WalletConnectButton size="xl" className="w-full" />
          </div>

          {isConnecting && (
            <Button
              variant="wallet"
              size="xl"
              disabled
              className="w-full max-w-sm"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting Wallet…
            </Button>
          )}

          <p className="text-sm text-muted-foreground">
            Secure wallet signature required for access
          </p>
        </div>
      </motion.div>

      {/* Footer badge */}
      <div className="absolute bottom-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 text-emerald-500" />
        <span>256-bit AES + Wallet-based authentication</span>
      </div>
    </div>
  );
}
