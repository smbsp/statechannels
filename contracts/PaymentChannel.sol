// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts//cryptography/ECDSA.sol';

contract PaymentChannel {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    enum Status {OPENED, JOINED, CLOSED}

    struct Channel {
        bytes32 channelId;
        address tokenAddr;
        address sender;
        address receiver;
        uint256 senderBalance;
        uint256 receiverBalance;
        uint nonce;
        Status status;
    }

    mapping(bytes32 => Channel) public channels;
    bytes32[] public channelList;

    event ChannelOpened(bytes32 indexed channelId, address indexed sender, uint256 indexed amount);
    event ReceiverJoined(bytes32 indexed channelId, address indexed receiver, uint256 indexed amount);
    event ChannelClosed(bytes32 indexed channelId, uint256 indexed senderBalance, uint256 indexed recipientBalance);

    function getChannelList() external view returns(bytes32[] memory) {
      bytes32[] memory _channelList = new bytes32[](channelList.length);
      for(uint i = 0; i < channelList.length; i++) { 
          _channelList[i] = channelList[i];
      }
      return _channelList;
    }

    function openChannel(address tokenAddress, address receiverAddress, uint256 amount) public isValidAmount(amount) {
        address sender = msg.sender;
        require(sender != receiverAddress, 'Sender and receiver cannot be same');
        bytes32 channelId = keccak256(abi.encodePacked(tokenAddress, sender, receiverAddress, block.number));
        channelList.push(channelId);
        Channel memory channel = Channel(
            channelId,
            tokenAddress,
            sender,
            receiverAddress,
            amount,
            0,
            0,
            Status.OPENED
        );
        _receive(channel.tokenAddr, sender, amount);
        channels[channelId] = channel;
        emit ChannelOpened(channelId, sender, amount);
    }

    function joinChannel(bytes32 channelId, uint256 amount) public isValidAmount(amount) isValidChannel(channelId) {
        address receiver = msg.sender;
        Channel storage channel = channels[channelId];
        require(channels[channelId].status == Status.OPENED, 'Channel should be in opened status');
        require(channel.receiver == receiver,'Sender specified a different receiver address');
        _receive(channel.tokenAddr, receiver, amount);
        channel.receiverBalance = amount;
        channel.status = Status.JOINED;
        emit ReceiverJoined(channelId, receiver, amount);
    }

    function closeChannel(
        bytes32 channelId,
        uint nonce,
        uint256 senderBalance,
        uint256 receiverBalance,
        bytes memory senderSignature,
        bytes memory receiverSignature
    ) public isValidChannel(channelId) {
        require(
            msg.sender == channels[channelId].sender || msg.sender == channels[channelId].receiver,
            'Need to be either sender or receiver'
        );
        require(channels[channelId].status == Status.JOINED, 'Channel should be in joined status');
        Channel storage channel = channels[channelId];
        bytes32 stateHash = keccak256(abi.encodePacked(channelId, senderBalance, receiverBalance, nonce));
        require(_ecverify(stateHash, senderSignature, channel.sender), 'Sender signature is invalid');
        require(_ecverify(stateHash, receiverSignature, channel.receiver), 'Receiver signature is invalid');
        channel.nonce = nonce;
        channel.senderBalance = senderBalance;
        channel.receiverBalance = receiverBalance;
        channel.status = Status.CLOSED;
        ERC20 token = ERC20(channel.tokenAddr);
        _send(token, channel.sender, channel.senderBalance);
        _send(token, channel.receiver, channel.receiverBalance);
        emit ChannelClosed(channelId, senderBalance, receiverBalance);
    }

    function _receive(address tokenAddress, address from, uint256 amount) internal isValidAmount(amount) {
        ERC20 token = ERC20(tokenAddress);
        require(token.transferFrom(from, address(this), amount), 'Error receiving tokens');
    }

    function _send(ERC20 token, address to, uint256 amount) internal isValidAmount(amount) {
        require(token.transfer(to, amount), 'Error sending tokens');
    }

    function _ecverify(bytes32 hash, bytes memory signature, address signer) internal pure returns (bool b) {
        bytes32 ethHash = hash.toEthSignedMessageHash();
        return ethHash.recover(signature) == signer;
    }
    
    modifier isValidAmount(uint256 amount) {
        require(amount > 0, 'Need to send valid amount of tokens');
        _;
    }
    
    modifier isValidChannel(bytes32 id) {
        require(channels[id].channelId != 0, 'Incorrect channel id');
        _;
    }

}
