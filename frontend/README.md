# ChatLock Frontend

ChatLock is a decentralized messaging client built with Next.js, Wagmi, and Ethers.js. Messages are encrypted in the browser, uploaded to IPFS, and only the IPFS CID plus message metadata are stored on-chain.

## Workflow

The app does not use a traditional centralized backend for message storage. Instead, the full request/response flow is split across the browser, a small Next.js server route, external Web3 services, and the deployed smart contract.

### 1. Session initialization and wallet access

1. The user opens the app and connects a wallet through RainbowKit and Wagmi.
2. The frontend reads the connected wallet address with `useAccount()` and uses that address as the user's identity.
3. During setup, the app stores lightweight profile data such as the display name in `localStorage`.
4. The encryption layer is initialized on the client. Encryption keys are generated or restored from `localStorage`, so the browser can encrypt outgoing messages and decrypt incoming ones.
5. Contacts are also stored locally in `localStorage`, keyed by the connected wallet address.

### 2. Starting a new conversation

1. In the "New Chat" screen, the user enters the recipient wallet address and an optional contact name.
2. The frontend validates the input before doing anything else:
   - the wallet must be connected
   - the recipient address must be a valid Ethereum address
   - the user cannot add their own address as a contact
3. If validation passes, the contact is stored locally and the user is redirected to the chat list.
4. If validation fails, the UI shows a destructive toast notification explaining the problem.

### 3. Sending a message from the frontend

1. Inside the conversation screen, the user types a message and chooses an expiration window.
2. Before submission, the frontend validates:
   - the message is not empty
   - the sender wallet is connected
   - the chat ID is a valid recipient address
3. Once validated, the send flow starts and the UI enters a loading state.
4. The plaintext message is encrypted in the browser. The encrypted payload contains:
   - the encrypted message body
   - the IV used for encryption
   - the sender address
   - the client-side creation timestamp
   - the expiration timestamp

### 4. API request to the backend route

1. After encryption, the frontend sends a `POST` request to `/api/ipfs/upload`.
2. This is the app's server-side backend layer inside Next.js.
3. The API route performs the following work:
   - reads the JSON request body
   - validates that Pinata credentials exist on the server
   - forwards the encrypted payload to Pinata's `pinJSONToIPFS` API
   - keeps Pinata API keys private so they are never exposed to the browser
4. If Pinata accepts the upload, the route extracts the returned `IpfsHash` and responds to the frontend with `{ cid }`.
5. If anything fails, the route returns a structured error response:
   - `400` for invalid JSON
   - `503` when Pinata credentials are missing
   - `502` when Pinata rejects the upload or returns an invalid response

### 5. Blockchain write and on-chain validation

1. Once the frontend receives the CID from the API route, it calls `sendMessageOnChain(receiver, cid, expiration)`.
2. The blockchain helper then:
   - ensures the wallet is connected to Sepolia
   - creates a browser-based signer from the injected wallet
   - verifies the active chain ID
   - submits `sendMessage(receiver, cid, expiration)` to the messenger contract
   - waits for confirmation using `await tx.wait()`
3. The smart contract becomes the authoritative metadata layer for the message. It validates:
   - receiver is not the zero address
   - CID is not empty
   - expiration is in the future
4. If validation passes, the contract stores the message metadata twice:
   - once under the sender's message list
   - once under the receiver's message list
5. The contract stores only metadata:
   - sender
   - receiver
   - CID
   - block timestamp
   - expiration timestamp
6. The contract then emits:

```solidity
event MessageSent(address indexed sender, address indexed receiver, string cid);
```

### 6. Returning the send result to the user

1. After the transaction is confirmed, the frontend treats the send as successful.
2. The conversation screen adds the message to local UI state and renders it immediately.
3. The user sees a success toast indicating that the message was encrypted, uploaded to IPFS, and recorded on Ethereum.
4. If any step fails, the loading state ends and the user sees an error toast.

### 7. Receiving messages and synchronizing data

The app uses two parallel mechanisms to make cross-client delivery reliable.

#### Event-driven updates

1. When a conversation screen is open, the frontend subscribes to **all** `MessageSent` events from the contract.
2. The event listener uses a stable read provider and can prefer WebSocket transport when `NEXT_PUBLIC_SEPOLIA_WS_RPC_URL` is configured.
3. The listener does not over-filter at the provider level. Instead, it receives global events and then filters in the UI for the active conversation:
   - `(sender === me && receiver === other)`
   - or `(sender === other && receiver === me)`
4. When a matching event arrives, the frontend:
   - reads the encrypted payload from the IPFS gateway using the CID
   - decrypts it locally
   - checks whether the message is still unexpired
   - merges it into the current message list without duplication

#### Polling fallback

1. Because blockchain events are not guaranteed to behave like a real-time messaging bus, the app also polls for message state.
2. On initial load and on a recurring interval, the conversation screen calls `getMessages(address)` through `fetchMessagesForUser()`.
3. The read helper uses a dedicated provider for reads and logs the active network and contract address for debugging.
4. The contract returns only unexpired messages for that wallet.
5. The frontend then:
   - filters down to the currently open conversation
   - fetches each missing CID from IPFS
   - decrypts the payload
   - merges only unseen messages into local state
6. This polling loop acts as a recovery mechanism when:
   - an event is missed
   - a browser tab was inactive
   - a provider temporarily dropped an event subscription

### 8. Data flow back to the frontend

The response path is different depending on the operation:

- For IPFS uploads, the Next.js API route returns a CID to the browser.
- For blockchain writes, the wallet returns a transaction hash first, and then a confirmed receipt after mining.
- For blockchain reads, the public read provider returns message metadata from the contract.
- For content retrieval, the IPFS gateway returns the encrypted JSON payload for each CID.
- For rendering, the frontend decrypts the payload locally and updates React state, which re-renders the conversation UI.

### 9. Storage and state responsibilities

The app distributes storage across multiple layers:

- `localStorage`: usernames, contact list, and locally generated encryption keys
- IPFS / Pinata: encrypted message payloads
- Smart contract: immutable message metadata and event history
- React state: currently visible messages, loading states, timers, and live UI updates

### 10. Error handling and notifications

The workflow includes defensive checks at multiple layers:

- Frontend validation prevents invalid wallet addresses, missing wallet connections, and empty messages.
- The Next.js API route returns explicit HTTP errors when upload prerequisites fail.
- Blockchain helpers throw errors for missing providers, wrong network selection, missing contract configuration, and failed transactions.
- The conversation screen catches decryption, event, polling, and send errors and logs them for debugging.
- User-facing feedback is delivered through toast notifications for:
  - wallet connection problems
  - invalid recipient input
  - contact creation success or failure
  - message send success
  - message send failure

### 11. End-to-end summary

In short, the message lifecycle is:

1. User writes a message in the frontend.
2. Frontend validates the input and encrypts the plaintext locally.
3. Frontend sends the encrypted payload to the Next.js API route.
4. The API route uploads the encrypted payload to Pinata/IPFS and returns the CID.
5. Frontend writes the CID and expiration metadata to the smart contract.
6. The contract stores message metadata and emits `MessageSent`.
7. Other clients receive the update through the event listener or polling fallback.
8. Those clients fetch the encrypted payload from IPFS, decrypt it locally, and render the message in the UI.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
