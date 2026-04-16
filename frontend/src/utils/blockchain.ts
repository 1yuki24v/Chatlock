import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  WebSocketProvider,
  type ContractEventPayload,
  type Eip1193Provider,
} from "ethers";
import { sepolia } from "viem/chains";
import type { Address } from "./encryption";

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const DEBUG_PREFIX = "[chatlock:blockchain]";
const SEPOLIA_CHAIN_ID = BigInt(sepolia.id);
const SEPOLIA_CHAIN_HEX = `0x${sepolia.id.toString(16)}`;

const MESSENGER_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_MESSENGER_CONTRACT_ADDRESS as Address | undefined) ||
  PLACEHOLDER_ADDRESS;

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

export interface MessageSentEvent {
  sender: Address;
  receiver: Address;
  cid: string;
  blockNumber?: number;
  transactionHash?: string;
}

type ReadProvider = JsonRpcProvider | WebSocketProvider;

let readProvider: ReadProvider | null = null;
let readContract: Contract | null = null;

function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || sepolia.rpcUrls.default.http[0];
}

function getWsRpcUrl() {
  return process.env.NEXT_PUBLIC_SEPOLIA_WS_RPC_URL;
}

function getInjectedProvider(): Eip1193Provider {
  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) {
    throw new Error("No injected Ethereum provider found (MetaMask required)");
  }

  return provider;
}

function getReadProvider(): ReadProvider {
  if (readProvider) {
    return readProvider;
  }

  const network = { chainId: sepolia.id, name: sepolia.name.toLowerCase() };
  const wsRpcUrl = getWsRpcUrl();

  if (wsRpcUrl) {
    readProvider = new WebSocketProvider(wsRpcUrl, network);
    console.debug(DEBUG_PREFIX, "Initialized read provider", {
      chainId: sepolia.id,
      contractAddress: MESSENGER_CONTRACT_ADDRESS,
      transport: "websocket",
      rpcUrl: wsRpcUrl,
    });
    return readProvider;
  }

  readProvider = new JsonRpcProvider(getRpcUrl(), network);
  readProvider.pollingInterval = 4000;
  console.debug(DEBUG_PREFIX, "Initialized read provider", {
    chainId: sepolia.id,
    contractAddress: MESSENGER_CONTRACT_ADDRESS,
    transport: "http",
    rpcUrl: getRpcUrl(),
    pollingInterval: readProvider.pollingInterval,
  });
  return readProvider;
}

function getReadContract(): Contract {
  if (!readContract) {
    readContract = new Contract(
      MESSENGER_CONTRACT_ADDRESS,
      MESSENGER_ABI,
      getReadProvider()
    );
  }

  return readContract;
}

function getBrowserProvider(): BrowserProvider {
  return new BrowserProvider(getInjectedProvider(), sepolia.id);
}

async function ensureSepoliaNetwork(): Promise<void> {
  const provider = getInjectedProvider();

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
  } catch (error: unknown) {
    const switchError = error as { code?: number };

    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_HEX,
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

function assertContractConfigured() {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    throw new Error(
      "Messenger contract address is not configured. Set NEXT_PUBLIC_MESSENGER_CONTRACT_ADDRESS."
    );
  }
}

export async function sendMessageOnChain(
  receiver: Address,
  cid: string,
  expirationTimestampMs: number
): Promise<`0x${string}`> {
  assertContractConfigured();
  await ensureSepoliaNetwork();

  const browserProvider = getBrowserProvider();
  const signer = await browserProvider.getSigner();
  const network = await browserProvider.getNetwork();

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error("Wallet is not connected to Sepolia.");
  }

  const sender = normalizeAddress(await signer.getAddress());
  const expirationSeconds = BigInt(Math.floor(expirationTimestampMs / 1000));
  const contract = new Contract(MESSENGER_CONTRACT_ADDRESS, MESSENGER_ABI, signer);

  console.debug(DEBUG_PREFIX, "Sending message", {
    sender,
    receiver,
    cid,
    chainId: network.chainId.toString(),
    contractAddress: MESSENGER_CONTRACT_ADDRESS,
    expirationSeconds: expirationSeconds.toString(),
  });

  const tx = await contract.sendMessage(receiver, cid, expirationSeconds);
  console.debug(DEBUG_PREFIX, "Transaction submitted", {
    hash: tx.hash,
    contractAddress: MESSENGER_CONTRACT_ADDRESS,
  });

  const receipt = await tx.wait();
  console.debug(DEBUG_PREFIX, "Transaction confirmed", {
    hash: tx.hash,
    blockNumber: receipt?.blockNumber,
    status: receipt?.status,
  });

  return tx.hash as `0x${string}`;
}

export async function fetchMessagesForUser(user: Address): Promise<OnChainMessage[]> {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    console.warn(
      DEBUG_PREFIX,
      "Messenger contract address is not configured. Returning empty message list."
    );
    return [];
  }

  const provider = getReadProvider();
  const network = await provider.getNetwork();
  console.debug(DEBUG_PREFIX, "Fetching messages", {
    user,
    chainId: network.chainId.toString(),
    contractAddress: MESSENGER_CONTRACT_ADDRESS,
  });

  const result = (await getReadContract().getMessages(user)) as Array<{
    sender: string;
    receiver: string;
    cid: string;
    timestamp: bigint;
    expirationTimestamp: bigint;
  }>;

  return result
    .map((message) => ({
      sender: normalizeAddress(message.sender),
      receiver: normalizeAddress(message.receiver),
      cid: message.cid,
      timestamp: BigInt(message.timestamp),
      expirationTimestamp: BigInt(message.expirationTimestamp),
    }))
    .sort((left, right) => {
      if (left.timestamp === right.timestamp) {
        return left.cid.localeCompare(right.cid);
      }
      return left.timestamp < right.timestamp ? -1 : 1;
    });
}

export function watchNewMessages(
  onMessage: (event: MessageSentEvent) => void | Promise<void>
): () => void {
  if (MESSENGER_CONTRACT_ADDRESS === PLACEHOLDER_ADDRESS) {
    console.warn(
      DEBUG_PREFIX,
      "Messenger contract address is not configured. Skipping event subscription."
    );
    return () => {};
  }

  const provider = getReadProvider();
  void provider
    .getNetwork()
    .then((network) => {
      console.debug(DEBUG_PREFIX, "Subscribing to MessageSent", {
        chainId: network.chainId.toString(),
        contractAddress: MESSENGER_CONTRACT_ADDRESS,
      });
    })
    .catch((error) => {
      console.error(DEBUG_PREFIX, "Failed to read network for MessageSent watcher", error);
    });

  const contract = getReadContract();
  const listener = (
    sender: string,
    receiver: string,
    cid: string,
    event: ContractEventPayload
  ) => {
    const nextEvent: MessageSentEvent = {
      sender: normalizeAddress(sender),
      receiver: normalizeAddress(receiver),
      cid,
      blockNumber: event.log.blockNumber,
      transactionHash: event.log.transactionHash,
    };

    console.debug(DEBUG_PREFIX, "MessageSent event received", nextEvent);

    Promise.resolve(onMessage(nextEvent)).catch((error) => {
      console.error(DEBUG_PREFIX, "MessageSent handler failed", error);
    });
  };

  contract.on("MessageSent", listener);

  return () => {
    contract.off("MessageSent", listener);
    console.debug(DEBUG_PREFIX, "Unsubscribed from MessageSent", {
      contractAddress: MESSENGER_CONTRACT_ADDRESS,
    });
  };
}
