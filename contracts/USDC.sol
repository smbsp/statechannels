// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract USDC is ERC20 {
    constructor() ERC20('USDC', 'USDC Stable Coin') {}
    
    function faucet(address to, uint amount) external {
        _mint(to, amount);
    }
}