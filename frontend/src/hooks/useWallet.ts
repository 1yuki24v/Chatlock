"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

export const useWallet = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const connectWallet = async () => {
    try {
      // Debug: Log available connectors
      console.log("Available connectors:", connectors.map(c => ({ id: c.id, name: c.name, type: c.type })));
      
      // Find any injected connector (MetaMask, Coinbase, etc.)
      // RainbowKit's getDefaultConfig includes multiple connectors
      const injectedConnector = connectors.find(
        (c) => 
          c.type === "injected" || 
          c.id?.toLowerCase().includes("metamask") ||
          c.id?.toLowerCase().includes("injected") ||
          c.name?.toLowerCase().includes("metamask") ||
          c.name?.toLowerCase().includes("browser")
      );
      
      // If no injected connector found, try the first available connector
      const connectorToUse = injectedConnector || connectors.find(c => c.ready) || connectors[0];
      
      if (!connectorToUse) {
        console.error("No connectors available. Available connectors:", connectors);
        // Show user-friendly error
        if (typeof window !== "undefined" && !window.ethereum) {
          alert("Please install MetaMask or another Web3 wallet to continue.");
        } else {
          alert("No wallet connector found. Please try refreshing the page or install MetaMask.");
        }
        return null;
      }
      
      console.log("Using connector:", connectorToUse.id, connectorToUse.name);
      
      await connect({ connector: connectorToUse });
      
      // Wait a bit for the connection to complete and address to be available
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Return the address after connection (it will be available via useAccount)
      return address;
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      
      // Provide user-friendly error messages
      if (error?.message?.includes("User rejected") || error?.code === 4001) {
        console.log("User rejected the connection request");
        // Don't show alert for user rejection
      } else if (error?.message?.includes("No provider") || error?.code === -32002) {
        alert("No wallet found. Please install MetaMask or another Web3 wallet.");
      } else {
        console.error("Connection error details:", error);
      }
      
      return null;
    }
  };

  const verifyOwnership = async (): Promise<boolean> => {
    if (!address) return false;

    try {
      const message = `Verify ownership of ${address}`;
      await signMessageAsync({
        message,
      });
      return true;
    } catch (error) {
      console.error("Failed to verify ownership:", error);
      return false;
    }
  };

  return {
    connect: connectWallet,
    disconnect,
    isConnecting,
    isConnected,
    address,
    verifyOwnership,
  };
};

