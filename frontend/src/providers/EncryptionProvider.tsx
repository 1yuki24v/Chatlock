"use client";

import { createContext, useContext, ReactNode } from "react";
import { useEncryption } from "@/hooks/useEncryption";

interface EncryptionContextType {
  encryptionKeys: { publicKey: string; privateKey: string } | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initializeEncryption: () => Promise<void>;
  encrypt: (message: string, recipientPublicKey?: string) => string;
  decrypt: (encryptedMessage: string) => string;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const encryption = useEncryption();

  return (
    <EncryptionContext.Provider value={encryption}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryptionContext() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error("useEncryptionContext must be used within EncryptionProvider");
  }
  return context;
}






