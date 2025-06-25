# DAO.js Test Suite Documentation

This document explains the DAO test suite (`test/DAO.js`) and how the quorum system works in our enhanced DAO implementation.

## Test Setup Overview

### Token Distribution
- **Total Supply**: 1,000,000 DAPP tokens
- **Distribution**: Each of 5 investors receives 200,000 tokens (20% each)
- **Deployer**: Retains 0 tokens after distribution

### Quorum Configuration
```javascript
dao = await DAO.deploy(token.address, '500000000000000000000001')
// Quorum = 500,000 tokens + 1 wei = 50% + 1 token
```

## How Quorum Works

### Basic Concept
- **Quorum**: Minimum number of votes required to finalize or cancel a proposal
- **Our Setting**: 500,000 tokens + 1 wei (just over 50% of total supply)
- **Vote Weight**: Each vote is weighted by the voter's token balance

### Voting Scenarios

#### Scenario 1: Reaching Quorum for Finalization
```javascript
// 3 investors vote in favor (600,000 tokens total)
investor1.vote(proposalId) // 200,000 tokens
investor2.vote(proposalId) // 200,000 tokens  
investor3.vote(proposalId) // 200,000 tokens
// Total: 600,000 > 500,000 (quorum reached)
```

#### Scenario 2: Insufficient Votes
```javascript
// Only 2 investors vote (400,000 tokens total)
investor1.vote(proposalId) // 200,000 tokens
investor2.vote(proposalId) // 200,000 tokens
// Total: 400,000 < 500,000 (quorum NOT reached)
```

#### Scenario 3: Cancellation via Negative Votes
```javascript
// 3 investors vote against (600,000 negative votes)
investor1.vote(proposalId, false) // -200,000 tokens
investor2.vote(proposalId, false) // -200,000 tokens
investor3.vote(proposalId, false) // -200,000 tokens
// negativeVotes: 600,000 > 500,000 (cancellation quorum reached)
```

## Test Structure

### 1. Deployment Tests
- Verifies DAO receives initial ETH funding
- Confirms token address is correctly set
- Validates quorum value

### 2. Proposal Creation Tests
**Success Cases:**
- Updates proposal count
- Stores proposal data correctly
- Emits Propose event

**Failure Cases:**
- Rejects proposals exceeding treasury balance
- Blocks non-token holders from creating proposals

### 3. Voting Tests
**Success Cases:**
- Updates `positiveVotes` counter
- Emits Vote event with correct parameters

**Failure Cases:**
- Prevents non-token holders from voting
- Blocks double voting attempts

### 4. Vote Against Tests
**Success Cases:**
- Updates `negativeVotes` counter
- Calculates net votes correctly (positive - negative)
- Emits Vote event with `false` parameter

### 5. Proposal Cancellation Tests
**Success Cases:**
- Marks proposal as cancelled when negative votes reach quorum
- Emits Cancel event

**Failure Cases:**
- Rejects cancellation with insufficient negative votes
- Blocks non-token holders from cancelling
- Prevents double cancellation

### 6. Governance Tests
**Success Cases:**
- Transfers funds to recipient when finalized
- Updates proposal status to finalized
- Emits Finalize event

**Failure Cases:**
- Blocks finalization without sufficient votes
- Prevents non-token holders from finalizing
- Blocks re-finalization of completed proposals
- Prevents finalization of cancelled proposals

## Key Testing Patterns

### Vote Weight Calculation
```javascript
// Each investor has 200,000 tokens
expect(proposal.positiveVotes).to.equal(tokens(200000))
```

### Quorum Validation
```javascript
// Need 3 investors (600,000 tokens) to exceed quorum of 500,000
transaction = await dao.connect(investor1)["vote(uint256)"](1)
transaction = await dao.connect(investor2)["vote(uint256)"](1)
transaction = await dao.connect(investor3)["vote(uint256)"](1)
// Now proposal can be finalized
```

### Function Overloading
```javascript
// Legacy vote (always votes in favor)
dao.connect(investor1)["vote(uint256)"](proposalId)

// Enhanced vote (specify direction)
dao.connect(investor1)["vote(uint256,bool)"](proposalId, false)
```

## Net Voting System

Our enhanced DAO tracks three vote metrics:
- **positiveVotes**: Total tokens voting in favor
- **negativeVotes**: Total tokens voting against  
- **votes**: Net votes (positiveVotes - negativeVotes)

### Examples:
```javascript
// Scenario: 3 for, 2 against
positiveVotes = 600,000  // 3 × 200,000
negativeVotes = 400,000  // 2 × 200,000
votes = 200,000          // 600,000 - 400,000
```
