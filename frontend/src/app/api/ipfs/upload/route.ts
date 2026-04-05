import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies encrypted payload uploads to Pinata.
 * Keeps Pinata API keys on the server only — avoids leaking secrets to the browser.
 */
export async function POST(req: NextRequest) {
  const pinataApiKey = process.env.PINATA_API_KEY;
  const pinataSecretApiKey = process.env.PINATA_API_SECRET;

  if (!pinataApiKey || !pinataSecretApiKey) {
    return NextResponse.json(
      {
        error:
          "Pinata is not configured. Add PINATA_API_KEY and PINATA_API_SECRET to .env.local.",
      },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Pinata expects { pinataContent: <json> }
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    body: JSON.stringify({
      pinataContent: payload,
    }),
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretApiKey,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      {
        error: `Pinata upload failed: ${res.status} ${res.statusText}`,
        detail: text.slice(0, 800),
        hint:
          res.status === 403 && /NO_SCOPES_FOUND/i.test(text)
            ? "Pinata API key has no pinning scopes. In Pinata dashboard → API keys → edit/create this key and enable pinning scopes (for pinJSONToIPFS/pinning/pinFileToIPFS)."
            : undefined,
      },
      { status: 502 }
    );
  }

  // Pinata returns JSON like: { IpfsHash: "...", ... }
  let json: { IpfsHash?: string };
  try {
    json = JSON.parse(text) as { IpfsHash?: string };
  } catch {
    return NextResponse.json(
      { error: "Could not parse Pinata response" },
      { status: 502 }
    );
  }

  if (!json.IpfsHash) {
    return NextResponse.json(
      { error: "Pinata response missing IpfsHash (CID)" },
      { status: 502 }
    );
  }

  return NextResponse.json({ cid: json.IpfsHash });
}
