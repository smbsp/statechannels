# State Channels

It is a simple implementation of state channels. 

## Description

State channels refer to the process in which users transact with one another directly outside of the blockchain, or 'off-chain,' and greatly minimize their use of 'on-chain' operations. It is one of the most exciting Ethereum Layer 2 scaling solutions.

## General flow

1. USDC - An ERC20 token is created and two parties, say, sender and receiver both hold USDC tokens<br>
2. Sender creates a channel using 'openChannel' function of the Smart Contract<br>
3. Receiver joins the channel using 'joinChannel' function of the Smart Contract<br>
4. The channel is established between the sender and receiver to process off-chain transactions<br>
5. The sender and receiver can make multiple transactions to each other and any of the parties can then submit the transaction to the Ethereum chain using 'closeChannel' function of the Smart Contract<br>
6. The main chain is updated with the off chain transactions and balances are updated on chain<br>

## Benefits

1. Saves gas fee for multiple transactions<br>
2. Speeds up transaction as it is happening off-chain<br>

## Test Scenario used for demonstration

1. Sender opens channel by depositing 100 USDC tokens (Main Chain: Sender Balance = 100, Receiver Balance = 0)<br>
2. Receiver joins channel by depositing 50 USDC tokens (Main Chain: Sender Balance = 100, Receiver Balance = 50)<br>
3. Sender sends receiver 10 USDC tokens 'off-chain' and signs it<br>
a) Main Chain: Sender Balance = 100, Receiver Balance = 50<br>
b) Off Chain: Sender Balance = 90, Receiver Balance = 60<br>
4. Receiver sends sender 5 USDC tokens 'off-chain' and signs it<br>
a) Main Chain: Sender Balance = 100, Receiver Balance = 50<br>
b) Off Chain: Sender Balance = 95, Receiver Balance = 55<br>
5. Sender closes the channel and the off-chain transactions are updated and settled on main chain (Main Chain: Sender Balance = 95, Receiver Balance = 55<br>

## Installation

Clone the repository and run the following commands.

```
npm install
truffle test
```

## Improvements

1. Better structuring and modularity of the project<br>
2. Can add complexity to the project by using an expiration time for closing channel
3. Adding a feature to challenge an off-chain transaction if one of the users act corrupt<br>
4. Creating a front-end to demonstrate the functionality and accepting token values at runtime 