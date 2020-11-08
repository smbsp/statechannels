const { expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const { utils } = web3;
const { keccak256 } = utils;

const PaymentChannel = artifacts.require('PaymentChannel');
const USDC = artifacts.require('USDC');
let receipt;

contract('PaymentChannel', accounts => {
  const [sender, receiver, other] = [accounts[0], accounts[1], accounts[2]];
  before(async() => {
    token = await USDC.new();
    tokenAddress = token.address;

    channel = await PaymentChannel.new();
    channelAddress = channel.address;

    const amount = web3.utils.toWei('1000');
    const seedTokenBalance = async (token, trader) => {
      await token.faucet(trader, amount)
      await token.approve(
        channel.address, 
        amount, 
        {from: trader}
      );
    };

    await Promise.all(
      [sender, receiver, other].map(
        trader => seedTokenBalance(token, trader) 
      )
    );
  });

  describe('Open a channel', () => {
    it('Should open channel', async () => {
      const amount = web3.utils.toWei('100');
      receipt = await channel.openChannel(
        tokenAddress,
        receiver,
        amount,
        {from: sender}
      );

      const { args } = receipt.logs.find(l => l.event === 'ChannelOpened');
      const { channelId } = args;
      const balance = await token.balanceOf(channelAddress); 
      const status = await channel.channels.call(channelId); 
      assert(parseInt(amount) === parseInt(balance));
      assert(status.status.toNumber() === 0);
      expectEvent(receipt, 'ChannelOpened', {
        channelId: channelId,
        sender: sender,
        amount: amount
      });
    });

    it('Should NOT open channel if tokens not sent', async () => {
      await expectRevert(
        channel.openChannel(
        tokenAddress,
        receiver,
        0,
        {from: sender}
      ),
      'Need to send valid amount of tokens'
      );
    });

    it('Should NOT open channel if sender and receiver are same', async () => {
      await expectRevert(
        channel.openChannel(
        tokenAddress,
        sender,
        100,
        {from: sender}
      ),
      'Sender and receiver cannot be same'
      );
    });
  });

  describe('Join a channel', () => {
    it('Should NOT join channel if receiver is different', async () => {
      const channelId = await channel.getChannelList();
      await expectRevert(
        channel.joinChannel(
          channelId[0],
          50,
          {from: other}
        ),
        'Sender specified a different receiver address'
      );
    });

    it('Should join channel', async () => {
      const channelId = await channel.getChannelList();
      const amount = web3.utils.toWei('50');
      const balanceBefore = await token.balanceOf(channelAddress);
      receipt = await channel.joinChannel(
        channelId[0],
        amount,
        {from: receiver}
      );
      const balance = await token.balanceOf(channelAddress); 
      const status = await channel.channels.call(channelId[0]); 
      assert(parseInt(amount) + (parseInt(balanceBefore)) === parseInt(balance));
      assert(status.status.toNumber() === 1);
      expectEvent(receipt, 'ReceiverJoined', {
        channelId: channelId[0],
        receiver: receiver,
        amount: amount
      });
    });

    it('Should NOT join channel if tokens not sent', async () => {
      const channelId = await channel.getChannelList();
      await expectRevert(
        channel.joinChannel(
          channelId[0],
          0,
          {from: receiver}
        ),
      'Need to send valid amount of tokens'
      );
    });

    it('Should NOT join channel if id is incorrect', async () => {
      await expectRevert(
        channel.joinChannel(
          web3.utils.asciiToHex('random'),
          50,
          {from: receiver}
        ),
        'Incorrect channel id'
      );
    });

    it('Should NOT join channel if channel is not opened', async () => {
      const channelId = await channel.getChannelList();
      await expectRevert(
        channel.joinChannel(
          channelId[0],
          50,
          {from: receiver}
        ),
        'Channel should be in opened status'
      );
    });
  });

  describe('Close a channel', () => {
    it('Should NOT close channel if id is incorrect', async () => {
      await expectRevert(
        channel.closeChannel(
          web3.utils.asciiToHex('random'),
          1,
          100,
          50,
          web3.utils.asciiToHex('random'),
          web3.utils.asciiToHex('random'),
          {from: sender}
        ),
        'Incorrect channel id'
      );
    });

    it('Should NOT close channel if sender signature is invalid', async () => {
      const channelId = await channel.getChannelList();
      const status = await channel.channels.call(channelId[0]); 
      await expectRevert(
        channel.closeChannel(
          status.channelId,
          1,
          100,
          50,
          '0x6cda370cc888fb48ee0aa38e213db0aa276f7443d8fc40d0c5fc42c549af97b67d6eb1e07bcdf0f9a0b42c62e53eafbd1d7dc11447f36c63f82f3106f2f75adf1b',
          '0x7047ccf5eece821e82a6ca7ec4f7581628be609c9d90f721b1b185f4c336d4e46ee74cf4873ed144606455ef5f72742f293f77ed4151d6d55e433155cce6fc821b',
          {from: sender}
        ),
        'Sender signature is invalid'
      );
    });

    it('Should close channel with OFF-CHAIN TRANSACTIONS', async () => {
      let closingParams = [];

      const getParams = () => {
        const params = closingParams[closingParams.length - 1];
        return params;
      };
      
      const channelId = await channel.getChannelList();
      const status = await channel.channels.call(channelId[0]);
      closingParams.push(status);

      const closeChannel = async (param, sender) => {
        const {
          channelId,
          senderBalance,
          receiverBalance,
          nonce,
          senderSignature,
          receiverSignature
        } = param;
    
        const receipt = await channel.closeChannel(
          channelId,
          `${nonce}`,
          `${senderBalance}`,
          `${receiverBalance}`,
          senderSignature,
          receiverSignature,
          { from: sender }
        );
    
        expectEvent(receipt, 'ChannelClosed', {
          channelId: channelId,
          senderBalance: senderBalance,
          recipientBalance: receiverBalance
        });
      };

      /**
     * @title Script to initiate balance transfers and sign off-chain
     
     * @dev Ethereum payment channels allow for off-chain transactions with an on-chain
     * settlement. In this implementation, a party (sender) can open a channel with a 
     * deposit and recipient. The recipient needs to join the channel. The sender and receiver
     * can then sign transactions off-chain and submit to close and settle the channel.
     */
      const offChainBalanceTransfer = async () => {
        const {
          senderBalance: senderBalanceBefore,
          receiverBalance: receiverBalanceBefore
        } = getParams();
        await transferTokens(sender, receiver, web3.utils.toWei(web3.utils.toBN(10)));
        await transferTokens(receiver, sender, web3.utils.toWei(web3.utils.toBN(5)));
        const {
          senderBalance: senderBalanceAfter,
          receiverBalance: receiverBalanceAfter
        } = getParams();
        assert(web3.utils.fromWei(senderBalanceAfter.sub(senderBalanceBefore)).toString() === '-5');
        assert(web3.utils.fromWei(receiverBalanceAfter.sub(receiverBalanceBefore)).toString() === '5');
      };

      const transferTokens = async (from, to, value) => {
        const params = getParams();
        const { sender } = params;
        let { senderBalance, receiverBalance, nonce } = params;
        if (from === sender) {
          senderBalance = senderBalance.sub(value);
          receiverBalance = receiverBalance.add(value);
        } else {
          senderBalance = senderBalance.add(value);
          receiverBalance = receiverBalance.sub(value);
        }
      
        nonce = nonce.add(new web3.utils.toBN(1));
    
        const newParam = {
          ...params,
          senderBalance,
          receiverBalance,
          nonce
        };
        const { senderSignature, receiverSignature } = await signParams(newParam);
        closingParams.push({ ...newParam, senderSignature, receiverSignature });
      };

      // generate valid signature
      const signParams = async param => {
        const {
          channelId,
          nonce,
          sender,
          senderBalance,
          receiver,
          receiverBalance
        } = param;
        const paramEncoded = web3.eth.abi.encodeParameters(
          ['bytes32', 'uint', 'uint', 'uint'],
          [channelId, `${senderBalance}`, `${receiverBalance}`, `${nonce}`]
        );
        const paramHash = keccak256(paramEncoded);
        const senderSignature = await sign(paramHash, sender);
        const receiverSignature = await sign(paramHash, receiver);
        return { senderSignature, receiverSignature };
      };

      const sign = async (data, signerAddress) => {
        const signature = await web3.eth.sign(data, signerAddress);
        const fixedSignature = fixSignature(signature);
        return fixedSignature;
      };
      
      const fixSignature = signature => {
        let v = parseInt(signature.slice(130, 132), 16);
        if (v < 27) {
          v += 27;
        }
        const vHex = v.toString(16);
        return signature.slice(0, 130) + vHex;
      };

      await offChainBalanceTransfer();
      let param = getParams();
      await closeChannel(param, sender);   
      const channelIdNew = await channel.getChannelList();
      const statusNew = await channel.channels.call(channelIdNew[0]); 
      assert(statusNew.status.toNumber() === 2);  
    });

    it('Should NOT close channel if status is not JOINED', async () => {
      const channelId = await channel.getChannelList();
      const status = await channel.channels.call(channelId[0]); 
      await expectRevert(
        channel.closeChannel(
          status.channelId,
          1,
          100,
          50,
          '0x6cda370cc888fb48ee0aa38e213db0aa276f7443d8fc40d0c5fc42c549af97b67d6eb1e07bcdf0f9a0b42c62e53eafbd1d7dc11447f36c63f82f3106f2f75adf1b',
          '0x7047ccf5eece821e82a6ca7ec4f7581628be609c9d90f721b1b185f4c336d4e46ee74cf4873ed144606455ef5f72742f293f77ed4151d6d55e433155cce6fc821b',
          {from: sender}
        ),
        'Channel should be in joined status'
      );
    });
  });
});