import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia } from "viem/chains";
import type { Address } from "./encryption";

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const MESSENGER_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MESSENGER_CONTRACT_ADDRESS as Address | undefined) ||
  // Placeholder – must be replaced with your deployed contract address
  PLACEHOLDER_ADDRESS;

// ABI for DecentralizedMessenger
export const MESSENGER_ABI = [
  {
    type: "event",
    name: "MessageSent",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "cid", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "sendMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "cid", type: "string" },
      { name: "expiration", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMessages",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "receiver", type: "address" },
          { name: "cid", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "expirationTimestamp", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export interface OnChainMessage {
  sender: Address;
  receiver: Address;
  cid: string;
  timestamp: bigint;
  expirationTimestamp: bigint;
}

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || sepolia.rpcUrls.default.http[0];
}

function getPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
}

function getWalletClient() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No injected Ethereum provider found (MetaMask required)");
  }

  return createWalletClient({
    chain: sepolia,
    transport: custom((window as any).ethereum),
  });
}

async function ensureSepoliaNetwork(): Promise<void> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No injected Ethereum provider found (MetaMask required)");
  }

  const provider = (window as any).ethereum;
  const targetChainHex = "0xaa36a7"; // 11155111 (Sepolia)

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainHex }],
    });
  } catch (error: any) {
    // 4902 = unknown chain in wallet
    if (error?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetChainHex,
            chainName: "Sepolia",
            nativeCurrency: {
              name: "Sepolia Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: [getRpcUrl()],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
      return;
    }
    throw new Error("Please switch MetaMask to Sepolia to send messages.");
  }
}

export async function sendMessageOnChain(
  receiver: Address,
  cid: string,
  expirationTimestampMs: number
): Promise<`0x${string}`> {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    throw new Error(
      "Messenger contract address is not configured. Set NEXT_PUBLIC_MESSENGER_CONTRACT_ADDRESS."
    );
  }

  await ensureSepoliaNetwork();

  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();

  const expirationSeconds = BigInt(Math.floor(expirationTimestampMs / 1000));

  const hash = await walletClient.writeContract({
    address: MESSENGER_CONTRACT_ADDRESS,
    abi: MESSENGER_ABI,
    functionName: "sendMessage",
    args: [receiver, cid, expirationSeconds],
    account,
  });

  return hash;
}

export async function fetchMessagesForUser(user: Address): Promise<OnChainMessage[]> {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    console.warn(
      "Messenger contract address is not configured. Returning empty message list."
    );
    return [];
  }

  const publicClient = getPublicClient();

  const result = (await publicClient.readContract({
    address: MESSENGER_CONTRACT_ADDRESS,
    abi: MESSENGER_ABI,
    functionName: "getMessages",
    args: [user],
  })) as any[];

  return result.map((m) => ({
    sender: m.sender as Address,
    receiver: m.receiver as Address,
    cid: m.cid as string,
    timestamp: BigInt(m.timestamp),
    expirationTimestamp: BigInt(m.expirationTimestamp),
  }));
}

export function watchNewMessages(
  user: Address,
  onMessage: (args: { sender: Address; receiver: Address; cid: string }) => void
): () => void {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    console.warn(
      "Messenger contract address is not configured. Skipping event subscription."
    );
    return () => {};
  }

  const publicClient = getPublicClient();

  const unwatch = publicClient.watchContractEvent({
    address: MESSENGER_CONTRACT_ADDRESS,
    abi: MESSENGER_ABI,
    eventName: "MessageSent",
    // Filter only logs involving this user
    args: {
      // indexed params; `null` means "any"
      sender: null,
      receiver: null,
    },
    onLogs: (logs) => {
      for (const log of logs) {
        const sender = log.args.sender as Address;
        const receiver = log.args.receiver as Address;
        const cid = log.args.cid as string;

        if (sender === user || receiver === user) {
          onMessage({ sender, receiver, cid });
        }
      }
    },
  });

  return unwatch;
}

