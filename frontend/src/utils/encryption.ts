import CryptoJS from "crypto-js";

export type Address = `0x${string}`;

export interface EncryptedPayload {
  encryptedMessage: string;
  iv: string;
  sender: Address;
  timestamp: number;
  expiration: number;
}

function toLower(address: string): string {
  return address.toLowerCase();
}

/**
 * Derive a shared symmetric key for a conversation using
 * SHA256(senderWallet + receiverWallet).
 */
export function deriveSharedKey(sender: Address, receiver: Address): CryptoJS.lib.WordArray {
  const concat = `${toLower(sender)}${toLower(receiver)}`;
  return CryptoJS.SHA256(concat);
}

/**
 * Encrypt a plaintext message for a given sender / receiver pair.
 * Encryption is AES on the client only, using a derived shared key and random IV.
 */
export function encryptMessage(
  plaintext: string,
  sender: Address,
  receiver: Address,
  expirationSeconds: number
): EncryptedPayload {
  const key = deriveSharedKey(sender, receiver);
  const iv = CryptoJS.lib.WordArray.random(16); // 128-bit IV

  const now = Date.now();
  const expiration = now + expirationSeconds * 1000;

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });

  return {
    encryptedMessage: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    iv: iv.toString(CryptoJS.enc.Hex),
    sender,
    timestamp: now,
    expiration,
  };
}

/**
 * Decrypt a previously encrypted payload.
 */
export function decryptMessage(
  payload: EncryptedPayload,
  sender: Address,
  receiver: Address
): string {
  const key = deriveSharedKey(sender, receiver);

  const iv = CryptoJS.enc.Hex.parse(payload.iv);
  const ciphertext = CryptoJS.enc.Base64.parse(payload.encryptedMessage);

  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext,
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

