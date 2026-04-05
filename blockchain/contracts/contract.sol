// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChatLock {
    
    // User profile information
    struct User {
        string name;
        address userAddress;
        bool exists;
        uint256 createdAt;
    }
    
    // Message structure stored on blockchain
    struct Message {
        address sender;
        address receiver;
        string content;
        uint256 timestamp;
    }
    
    // State mappings for efficient data access
    mapping(address => User) public users;
    mapping(address => address[]) public friendList;
    mapping(address => mapping(address => bool)) public isFriend;
    mapping(address => Message[]) private userMessages;
    
    address[] public userList;
    Message[] public allMessages;
}
