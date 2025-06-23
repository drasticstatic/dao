# Enhanced DAO Governance Platform

A decentralized autonomous organization (DAO) where token holders can create, vote on, and finalize funding proposals.

## Features

- **Token-Based Governance**: Only token holders can create proposals and vote
- **Bidirectional Voting**: Vote in favor or against proposals
- **Proposal Management**: Create, vote, finalize, or cancel proposals
- **Analytics Dashboard**: View key metrics about proposal activity and voting patterns
- **Responsive UI**: Mobile-friendly interface with fixed headers and clear visual indicators

## Key Components

### Smart Contract Features

- **Token Integration**: Uses ERC-20 token for governance rights
- **Vote Weighting**: Votes are weighted by token balance
- **Quorum System**: Proposals require a minimum number of votes to be finalized
- **Cancellation Mechanism**: Proposals can be cancelled if they receive enough negative votes

### Frontend Features

- **Real-time Updates**: UI reflects blockchain state changes
- **Visual Progress Tracking**: Separate progress bars for votes in favor and against
- **Analytics Dashboard**: Shows proposal status distribution, voting patterns, and participation metrics
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start local blockchain: `npx hardhat node`
4. Deploy contracts: `npx hardhat run scripts/deploy.js --network localhost`
5. Seed initial data: `npx hardhat run scripts/seed.js --network localhost`
6. Start frontend: `npm run start`

## Usage

1. **Create Proposals**: Fill out the form at the top of the page
2. **Vote on Proposals**: Use the "For" and "Against" buttons to cast your vote
3. **Finalize Proposals**: When a proposal reaches quorum of positive votes, click "Finalize"
4. **Cancel Proposals**: When a proposal reaches quorum of negative votes, click "Cancel"
5. **View Analytics**: Check the analytics dashboard for insights on DAO activity

## Technical Details

- Built with React, Ethers.js, and Hardhat
- Uses Bootstrap for responsive UI components
- Smart contracts written in Solidity
- Implements EIP-712 for secure transaction signing