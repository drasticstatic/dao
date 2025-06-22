# DAO (Decentralized Autonomous Organization)

A blockchain-based governance system that allows token holders to create, vote on, and execute proposals for treasury fund allocation.

## Project Overview

This DAO (Decentralized Autonomous Organization) project is built using:
- Solidity smart contracts (for the blockchain logic)
- React.js (for the frontend interface)
- Hardhat (for Ethereum development environment)
- Ethers.js (for blockchain interactions)

The DAO allows token holders to participate in the governance of a shared treasury. Only token holders can create proposals and vote on them. When a proposal reaches the required quorum, it can be finalized, transferring funds to the designated recipient.

## How It Works

1. **Create Proposal**: Token holders can create proposals specifying an amount and recipient
2. **Vote**: Other token holders can vote on proposals
3. **Reach Quorum**: Proposals need to reach a minimum number of votes (quorum)
4. **Finalize**: Once quorum is reached, any token holder can finalize the proposal
5. **Transfer Funds**: Upon finalization, funds are transferred to the recipient

## Smart Contracts

The project includes two main smart contracts:

1. **Token.sol**: ERC-20 token contract that represents governance rights
2. **DAO.sol**: The main DAO contract that handles proposals, voting, and fund transfers

## Frontend Features

The React frontend provides an intuitive interface for interacting with the DAO:

- **Proposal Creation**: Form to create new proposals
- **Proposal Listing**: Table showing all proposals with their status
- **Voting Interface**: Buttons to vote on active proposals
- **Finalization**: Ability to finalize proposals that reached quorum
- **Visual Indicators**: Progress bars showing voting progress toward quorum

## Recent UI Improvements

The Proposals component has been enhanced with the following features:

- **Progress Bars**: Visual representation of voting progress toward quorum
- **Status Badges**: Color-coded badges showing proposal status (In Progress, Ready to Finalize, Approved)
- **Loading States**: Spinners during blockchain transactions
- **Tooltips**: Additional information on hover
- **Address Formatting**: Shortened addresses with full address on hover
- **Better Error Handling**: Detailed error messages from blockchain transactions
- **Empty State Handling**: Clear message when no proposals exist

### Latest Enhancements

- **Blockchain Vote Verification**: Direct verification of votes using smart contract calls
- **MetaMask Account Change Detection**: Automatic UI refresh when switching accounts
- **Number Formatting**: K/M/B/T notation for large numbers with tooltips showing exact values
- **Improved Badge Styling**: Better visual hierarchy with centered, properly sized badges
- **Copyable Addresses**: Click-to-copy functionality for Ethereum addresses
- **Connection Indicators**: Clear visual indicators of wallet connection status
- **Responsive Layout**: Better organization of UI elements across different screen sizes
- **Developer Tools**: Debug buttons and enhanced console logging for development

## Technical Implementation Notes

- **Vote Tracking**: Uses the contract's `hasVoted` function to verify votes directly from the blockchain
- **Conditional Rendering**: UI elements change based on proposal state and user actions
- **Blockchain Interactions**: Uses ethers.js to interact with the smart contracts
- **Responsive Design**: Bootstrap components for a mobile-friendly interface
- **Event Handling**: Listens for MetaMask account changes to refresh data automatically
- **Number Formatting**: Smart formatting of large numbers with appropriate notation
- **Error Handling**: Robust error handling for blockchain interactions with user feedback

## Getting Started

### Prerequisites

- Node.js and npm
- MetaMask or another Ethereum wallet

### Installation

1. Clone the repository
```shell
git clone <repository-url>
cd dao
```

2. Install dependencies
```shell
npm install
```

3. Start a local Hardhat node
```shell
npx hardhat node
```

4. Deploy the contracts
```shell
npx hardhat run scripts/deploy.js --network localhost
```

5. Seed the contracts with initial data
```shell
npx hardhat run scripts/seed.js --network localhost
```

6. Start the frontend
```shell
npm start
```

## Testing

Run the test suite with:
```shell
npx hardhat test
```# dao
