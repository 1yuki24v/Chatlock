// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract ChatLock {

    /* =========================================================
       STRUCTS
       ========================================================= */

    // Stores basic user data
    struct User {
        string name;                
        Friend[] friendList;        
    }

    // Stores friend information
    struct Friend {
        address pubkey;              
        string name;                
    }

    // Stores chat message data
    struct Message {
        address sender;              
        uint256 timestamp;          
        string msg;                  
    }

    // Stores all registered users (for listing)
    struct AllUserStruct {
        string name;
        address accountAddress;
    }

    // Array to track all users
    AllUserStruct[] private getAllUsers; 

    /* =========================================================
       STATE VARIABLES
       ========================================================= */

    mapping(address => User) private userList;
    mapping(bytes32 => Message[]) private allMessages;

    /* =========================================================
       USER MANAGEMENT
       ========================================================= */

    function checkUserExist(address pubkey) public view returns (bool) {
        return bytes(userList[pubkey].name).length > 0;
    }

    function createAccount(string calldata name) external {
        require(!checkUserExist(msg.sender), "User already exists");
        require(bytes(name).length > 0, "Username cannot be empty");

        userList[msg.sender].name = name;

        // Add to all users list
        getAllUsers.push(AllUserStruct(name, msg.sender));
    }

    function getUsername(address pubkey) external view returns (string memory) {
        require(checkUserExist(pubkey), "User is not registered");
        return userList[pubkey].name;
    }

    /* =========================================================
       FRIEND MANAGEMENT
       ========================================================= */

    function addFriend(address friendKey, string calldata name) external {
        require(checkUserExist(msg.sender), "Create an account first");
        require(checkUserExist(friendKey), "User is not registered");
        require(msg.sender != friendKey, "You cannot add yourself");
        require(
            !checkAlreadyFriends(msg.sender, friendKey),
            "Users are already friends"
        );

        _addFriend(msg.sender, friendKey, name);
        _addFriend(friendKey, msg.sender, userList[msg.sender].name);
    }

    function checkAlreadyFriends(address pubkey1, address pubkey2) internal view returns (bool) {
        if (userList[pubkey1].friendList.length > userList[pubkey2].friendList.length) {
            address temp = pubkey1;
            pubkey1 = pubkey2;
            pubkey2 = temp;
        }

        for (uint256 i = 0; i < userList[pubkey1].friendList.length; i++) {
            if (userList[pubkey1].friendList[i].pubkey == pubkey2) {
                return true;
            }
        }
        return false;
    }

    function _addFriend(address me, address friendKey, string memory name) internal {
        userList[me].friendList.push(Friend(friendKey, name));
    }

    function getMyFriendList() external view returns (Friend[] memory) {
        return userList[msg.sender].friendList;
    }

    /* =========================================================
       CHAT LOGIC
       ========================================================= */

    function _getChatCode(address pubkey1, address pubkey2) internal pure returns (bytes32) {
        if (pubkey1 < pubkey2) {
            return keccak256(abi.encodePacked(pubkey1, pubkey2));
        } else {
            return keccak256(abi.encodePacked(pubkey2, pubkey1));
        }
    }

    function sendMessage(address friendKey, string calldata _msg) external {
        require(checkUserExist(msg.sender), "Create an account first");
        require(checkUserExist(friendKey), "User is not registered");
        require(
            checkAlreadyFriends(msg.sender, friendKey),
            "You are not friends with this user"
        );

        bytes32 chatCode = _getChatCode(msg.sender, friendKey);
        allMessages[chatCode].push(Message(msg.sender, block.timestamp, _msg));
    }

    function readMessage(address friendKey) external view returns (Message[] memory) {
        bytes32 chatCode = _getChatCode(msg.sender, friendKey);
        return allMessages[chatCode];
    }

    /* =========================================================
       GET ALL USERS
       ========================================================= */

    function getAllAppUsers() public view returns (AllUserStruct[] memory){
        return getAllUsers;
    }
}

