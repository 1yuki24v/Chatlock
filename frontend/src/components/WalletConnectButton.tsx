"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2 } from "lucide-react";

interface WalletConnectButtonProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "xl" | "icon";
}

export function WalletConnectButton({ className, size = "xl" }: WalletConnectButtonProps) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button
                    variant="wallet"
                    size={size}
                    onClick={openConnectModal}
                    className={className}
                  >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    variant="destructive"
                    size={size}
                    onClick={openChainModal}
                    className={className}
                  >
                    Wrong network
                  </Button>
                );
              }

              return (
                <Button
                  variant="wallet"
                  size={size}
                  onClick={openAccountModal}
                  className={className}
                >
                  {account.displayName}
                  {account.displayBalance
                    ? ` (${account.displayBalance})`
                    : ""}
                </Button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}





