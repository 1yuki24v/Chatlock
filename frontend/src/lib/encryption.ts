import CryptoJS from "crypto-js";

export function compressPublicKey(publicKey: string): string {
  // Compress public key for display (first 8 chars + last 8 chars)
  if (publicKey.length <= 16) return publicKey;
  return `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
}

export function generateKeyPair() {
  const privateKey = CryptoJS.lib.WordArray.random(256 / 8).toString();
  const publicKey = CryptoJS.SHA256(privateKey).toString();
  return { publicKey, privateKey };
}






