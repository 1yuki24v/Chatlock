const STORAGE_PREFIX = "chatlock_contacts_";

export interface Contact {
  address: string;
  name: string;
}

function storageKey(walletAddress: string): string {
  return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
}

export function getContacts(walletAddress: string): Contact[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Contact[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addContact(walletAddress: string, contact: Contact): void {
  if (!walletAddress || !contact?.address) return;
  const key = storageKey(walletAddress);
  const normalized = {
    address: contact.address.trim().toLowerCase(),
    name: (contact.name || contact.address.slice(0, 10) + "...").trim(),
  };
  const list = getContacts(walletAddress);
  if (list.some((c) => c.address === normalized.address)) return;
  const next = [...list, normalized];
  localStorage.setItem(key, JSON.stringify(next));
}

export function removeContact(walletAddress: string, contactAddress: string): void {
  if (!walletAddress || !contactAddress) return;
  const list = getContacts(walletAddress).filter(
    (c) => c.address !== contactAddress.trim().toLowerCase()
  );
  localStorage.setItem(storageKey(walletAddress), JSON.stringify(list));
}

export function isOwnAddress(walletAddress: string, inputAddress: string): boolean {
  if (!walletAddress || !inputAddress) return false;
  return walletAddress.toLowerCase() === inputAddress.trim().toLowerCase();
}

export function isValidEthAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value?.trim() ?? "");
}
