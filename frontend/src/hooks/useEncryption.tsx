"use client";

import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { useWallet } from "./useWallet";

interface EncryptionKeys {
  publicKey: string;
  privateKey: string;
}

export const useEncryption = () => {
  const { address } = useWallet();
  const [encryptionKeys, setEncryptionKeys] = useState<EncryptionKeys | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const generateKeys = useCallback((): EncryptionKeys => {
    // Generate a random key pair (simplified - in production use proper crypto)
    const privateKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
    const publicKey = CryptoJS.SHA256(privateKey).toString();
    return { publicKey, privateKey };
  }, []);

  const initializeEncryption = useCallback(async () => {
    if (!address) return;

    setIsInitializing(true);
    try {
      const storageKey = `chatlock_keys_${address}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const keys = JSON.parse(stored);
        setEncryptionKeys(keys);
        setIsInitialized(true);
      } else {
        const keys = generateKeys();
        localStorage.setItem(storageKey, JSON.stringify(keys));
        setEncryptionKeys(keys);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error("Failed to initialize encryption:", error);
    } finally {
      setIsInitializing(false);
    }
  }, [address, generateKeys]);

  useEffect(() => {
    if (address && !isInitialized && !isInitializing) {
      initializeEncryption();
    }
  }, [address, isInitialized, isInitializing, initializeEncryption]);

  const encrypt = useCallback((message: string, recipientPublicKey?: string): string => {
    if (!encryptionKeys) {
      throw new Error("Encryption not initialized");
    }
    // Simplified encryption - in production use proper E2E encryption
    return CryptoJS.AES.encrypt(message, encryptionKeys.privateKey).toString();
  }, [encryptionKeys]);

  const decrypt = useCallback((encryptedMessage: string): string => {
    if (!encryptionKeys) {
      throw new Error("Encryption not initialized");
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, encryptionKeys.privateKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Decryption failed:", error);
      return "";
    }
  }, [encryptionKeys]);

  return {
    encryptionKeys,
    isInitialized,
    isInitializing,
    initializeEncryption,
    encrypt,
    decrypt,
  };
};






