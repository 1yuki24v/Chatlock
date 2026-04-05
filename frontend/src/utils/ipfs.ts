import type { EncryptedPayload } from "./encryption";

const IPFS_GATEWAY_URL =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ||
  "https://gateway.pinata.cloud/ipfs/";

async function uploadViaServerProxy(payload: EncryptedPayload): Promise<string> {
  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    cid?: string;
    error?: string;
    detail?: string;
  };

  if (!res.ok) {
    const msg =
      data.error ||
      `Failed to upload payload to IPFS: ${res.status} ${res.statusText}`;
    const extra = data.detail ? ` — ${data.detail}` : "";
    throw new Error(`${msg}${extra}`);
  }

  if (!data.cid) {
    throw new Error("IPFS upload succeeded but no CID returned");
  }

  return data.cid;
}

export async function uploadEncryptedPayload(
  payload: EncryptedPayload
): Promise<string> {
  return uploadViaServerProxy(payload);
}

export async function fetchEncryptedPayload(cid: string): Promise<EncryptedPayload> {
  const res = await fetch(`${IPFS_GATEWAY_URL}${cid}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS payload for CID ${cid}`);
  }
  const json = await res.json();
  return json as EncryptedPayload;
}

