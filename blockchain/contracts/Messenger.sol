// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DecentralizedMessenger
 * @notice Stores encrypted message metadata for off-chain (IPFS) payloads.
 *
 * Messages are always stored twice – once for the sender and once for the receiver –
 * so that each party can independently query their inbox with `getMessages`.
 *
 * The actual encrypted content never touches the chain. Only the IPFS CID and
 * minimal metadata (sender, receiver, timestamps) are persisted here.
 */
contract DecentralizedMessenger {
    struct Message {
        address sender;
        address receiver;
        string cid;
        uint256 timestamp;
        uint256 expirationTimestamp;
    }

    // user => messages involving this user (either as sender or receiver)
    mapping(address => Message[]) private _messagesByUser;

    event MessageSent(address indexed sender, address indexed receiver, string cid);

    /**
     * @notice Send a new message.
     * @param receiver The receiver wallet address.
     * @param cid The IPFS CID that points to the encrypted payload.
     * @param expiration The absolute expiration timestamp (unix seconds).
     */
    function sendMessage(address receiver, string calldata cid, uint256 expiration) external {
        require(receiver != address(0), "Invalid receiver");
        require(bytes(cid).length > 0, "CID required");
        require(expiration > block.timestamp, "Expiration must be in the future");

        Message memory message = Message({
            sender: msg.sender,
            receiver: receiver,
            cid: cid,
            timestamp: block.timestamp,
            expirationTimestamp: expiration
        });

        // Store for both sender and receiver so each can query independently.
        _messagesByUser[msg.sender].push(message);
        _messagesByUser[receiver].push(message);

        emit MessageSent(msg.sender, receiver, cid);
    }

    /**
     * @notice Get all messages where `user` is either sender or receiver.
     * @dev This function filters out expired messages. Decryption still happens in the frontend.
     */
    function getMessages(address user) external view returns (Message[] memory) {
        Message[] storage all = _messagesByUser[user];

        // Count unexpired messages first (two-pass to allocate exact array size).
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].expirationTimestamp > block.timestamp) {
                count++;
            }
        }

        Message[] memory filtered = new Message[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].expirationTimestamp > block.timestamp) {
                filtered[j] = all[i];
                j++;
            }
        }

        return filtered;
    }
}

