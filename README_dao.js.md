# DAO.js Test Suite Documentation

This document explains the DAO test suite (`test/DAO.js`) and how the quorum system mechanics work in our enhanced DAO implementation.

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

## Understanding Proposal IDs in Tests

### How Proposal IDs Are Assigned
```solidity
uint256 public proposalCount; // Starts at 0

function createProposal(...) {
    proposalCount++; // Increment first (1, 2, 3...)
    proposals[proposalCount] = Proposal(...); // Store at that ID
}
```

### Test Isolation and ID Management

Each test gets a fresh blockchain state, but within a single test:

```javascript
describe('Governance', () => {
  beforeEach(async () => {
    // Creates Proposal 1 for this test suite
    transaction = await dao.connect(investor1).createProposal('Proposal 1', ...)
  })
  
  it('rejects finalization of cancelled proposal', async () => {
    // Need separate proposal to test cancellation scenario
    // Creates Proposal 2 (proposalCount becomes 2)
    transaction = await dao.connect(investor1).createProposal('Proposal 2', ...)
    
    // Work with proposalId=2 for this specific test
    await dao.connect(investor1).vote(2, false)
    await dao.connect(investor1).cancelProposal(2)
    await expect(dao.connect(investor1).finalizeProposal(2))
      .to.be.revertedWith('proposal was cancelled')
  })
})
```

### Why We Use Different Proposal IDs

| Scenario | Proposal ID | Purpose |
|----------|-------------|----------|
| **Standard tests** | `1` | Use proposal from `beforeEach` |
| **Isolation needed** | `2` | Create fresh proposal for specific test |
| **Multiple proposals** | `1, 2, 3...` | Test interactions between proposals |

### Best Practice Pattern
```javascript
// ✅ Good - Clear separation of concerns
it('specific test scenario', async () => {
  // Create dedicated proposal for this test
  await dao.createProposal('Test Proposal', ...)
  const newProposalId = await dao.proposalCount() // Get latest ID
  
  // Test specific scenario with clean state
  await dao.vote(newProposalId, false)
  await dao.cancelProposal(newProposalId)
})

// ❌ Avoid - Reusing proposals can cause test interdependence
it('test that modifies existing proposal', async () => {
  await dao.vote(1, true) // Modifies proposal from beforeEach
  // This could affect other tests
})
```

### Key Takeaway
Using different proposal IDs (like proposalId=2) ensures test isolation and allows testing specific scenarios without interference from setup data. Each proposal ID represents a separate governance decision with its own voting history and state.

## Test Coverage Summary

Our comprehensive test suite includes **42 tests** covering:

- **8 tests** - Basic deployment and setup
- **8 tests** - Proposal creation (success/failure cases)
- **5 tests** - Legacy voting functionality
- **3 tests** - Vote against functionality
- **6 tests** - Proposal cancellation mechanics
- **12 tests** - Governance and finalization logic

### Critical Test Scenarios

1. **Edge Cases**: Double voting, insufficient funds, non-token holders
2. **State Transitions**: Active → Finalized, Active → Cancelled
3. **Cross-Feature Interactions**: Cancelled proposals can't be finalized
4. **Error Handling**: Specific error messages for all failure modes
5. **Event Emissions**: All contract events properly emitted

## Common Test Patterns

### Error Message Testing
```javascript
// ✅ Specific error testing
await expect(dao.connect(user).vote(1, true))
  .to.be.revertedWith('must be token holder')

// ❌ Generic error testing  
await expect(dao.connect(user).vote(1, true))
  .to.be.reverted
```

### State Verification
```javascript
// Check multiple state changes in one test
const proposal = await dao.proposals(1)
expect(proposal.finalized).to.equal(true)
expect(proposal.cancelled).to.equal(false)
```

### Event Testing
```javascript
// Verify events with exact parameters
await expect(transaction).to.emit(dao, "Vote")
  .withArgs(proposalId, voterAddress, inFavor)
```

## Analytics Component Integration

The test suite also supports our **ProposalAnalytics** component by ensuring:

- Proposal state tracking (active/finalized/cancelled)
- Vote counting (positive/negative/net votes)
- Quorum calculations and success rates
- Participation metrics

This comprehensive testing ensures the analytics dashboard displays accurate, real-time governance data.
