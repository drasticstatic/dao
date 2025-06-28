# DAO Test Suite Documentation Guide

> **42 comprehensive tests** covering enhanced DAO governance with vote-against functionality and proposal cancellation

## 🎯 Quick Start

Our DAO test suite validates a governance system where:
- **5 investors** each hold 200,000 DAPP tokens (20% each)
- **Quorum**: 500,000+ tokens needed to finalize/cancel proposals
- **Enhanced voting**: Support for both legacy and directional voting

## 📊 Test Architecture

### Core Setup
```javascript
// Token distribution: 1M total, 200K each to 5 investors
dao = await DAO.deploy(token.address, '500000000000000000000001')
// Quorum = 50% + 1 token for democratic decisions = 500,000 tokens + 1 wei
```

### Test Categories (42 Total)
| Category | Tests | Purpose |
|----------|-------|---------|
| **Deployment** | 3 | Basic setup validation |
| **Proposals** | 5 | Creation & validation |
| **Voting** | 5 | Standard voting mechanics |
| **Vote Against** | 3 | Negative voting system |
| **Cancellation** | 6 | Proposal cancellation logic |
| **Governance** | 8 | Finalization & treasury |
| **Token Suite** | 12 | ERC-20 functionality |

## 🗳️ Voting System Explained

### Three Vote Metrics Tracked
- **positiveVotes**: Tokens voting in favor
- **negativeVotes**: Tokens voting against
- **votes**: Net result (positive - negative)

### Quorum Scenarios

**✅ Success: 3 investors vote (600K tokens) - Reaching Quorum for Finalization**
```javascript
investor1.vote(proposalId, true)  // 200K tokens
investor2.vote(proposalId, true)  // 200K tokens  
investor3.vote(proposalId, true)  // 200K tokens
// Total: 600K > 500K quorum ✓
```

**❌ Failure: 2 investors vote (400K tokens) - Insufficient Votes**
```javascript
investor1.vote(proposalId, true)  // 200K tokens
investor2.vote(proposalId, true)  // 200K tokens
// Total: 400K < 500K quorum ✗
```

**🚫 Cancellation: 3 vote against (600K negative)**
```javascript
investor1.vote(proposalId, false) // -200K tokens
investor2.vote(proposalId, false) // -200K tokens
investor3.vote(proposalId, false) // -200K tokens
// Negative votes: 600K > 500K quorum → CANCELLED
```

## 🔧 Key Testing Structures & Patterns

### Function Overloading Support
```javascript
// Legacy vote (always in favor)
dao.connect(investor1)["vote(uint256)"](proposalId)

// Enhanced vote (specify direction)  
dao.connect(investor1)["vote(uint256,bool)"](proposalId, false)
```

### 🆔 Proposal ID Management
&nbsp;&nbsp;&nbsp;&nbsp;Understanding Proposal IDs in Tests

### Auto-Increment System
&nbsp;&nbsp;&nbsp;&nbsp;How Proposal IDs Are Assigned
```solidity
uint256 public proposalCount; // Starts at 0

function createProposal(...) {
    proposalCount++; // Increment first (1, 2, 3...)
    proposals[proposalCount] = Proposal(...); // Store at that ID
}
```

### Test Isolation and ID Management

&nbsp;&nbsp;&nbsp;&nbsp;Each test gets a fresh blockchain state, but within a single test:

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

## 🎯 Critical Test Scenarios

### Edge Cases Covered
- **Double voting prevention**
- **Non-token holder restrictions**
- **Insufficient fund rejections**
- **State Transitions**: Active → Finalized, Active → Cancelled
- **Cross-Feature Interactions**: Cancelled proposals can't be finalized

### State Verification
```javascript
// Check multiple state changes in one test
const proposal = await dao.proposals(1)
expect(proposal.finalized).to.equal(true)
expect(proposal.cancelled).to.equal(false)
```

### Error Handling
- **Specific error messages** for all failure modes
- **Access control** validation
- **Business logic** enforcement
- **State consistency** checks

### Error Message Testing
```javascript
// ✅ Specific error testing
await expect(dao.connect(user).vote(1, true))
  .to.be.revertedWith('must be token holder')

// ❌ Generic error testing  
await expect(dao.connect(user).vote(1, true))
  .to.be.reverted
```

### Event Emissions
```javascript
await expect(transaction).to.emit(dao, "Vote")
  .withArgs(proposalId, voterAddress, inFavor)
```

## 📈 Analytics Integration

The test suite also supports our **ProposalAnalytics** component by ensuring:
- Proposal state tracking (active/finalized/cancelled)
- Vote counting (positive/negative/net)
- Quorum success rates
- Participation metrics

## 🚀 Running Tests

```bash
npx hardhat test
# Expected: 42 passing tests
```

## 💡 Key Takeaways

1. **Comprehensive Coverage**: 42 tests validate all governance scenarios
2. **Enhanced Voting**: Supports both legacy and directional voting
3. **Proposal Isolation**: Each test uses appropriate proposal IDs
4. **Specific Testing**: Error messages and state changes verified precisely
5. **Analytics Ready**: Tests support real-time dashboard metrics

## 📋 Detailed Test Breakdown

### Deployment Tests (3 tests)
- Verifies DAO receives initial ETH funding
- Confirms token address is correctly set
- Validates quorum value

### Proposal Creation Tests (5 tests)
**Success Cases:**
- Updates proposal count
- Stores proposal data correctly
- Emits Propose event

**Failure Cases:**
- Rejects proposals exceeding treasury balance
- Blocks non-token holders from creating proposals

### Voting Tests (5 tests)
**Success Cases:**
- Updates `positiveVotes` counter
- Emits Vote event with correct parameters

**Failure Cases:**
- Prevents non-token holders from voting
- Blocks double voting attempts

### Vote Against Tests (3 tests)
**Success Cases:**
- Updates `negativeVotes` counter
- Calculates net votes correctly (positive - negative)
- Emits Vote event with `false` parameter

### Proposal Cancellation Tests (6 tests)
**Success Cases:**
- Marks proposal as cancelled when negative votes reach quorum
- Emits Cancel event

**Failure Cases:**
- Rejects cancellation with insufficient negative votes
- Blocks non-token holders from cancelling
- Prevents double cancellation

### Governance Tests (8 tests)
**Success Cases:**
- Transfers funds to recipient when finalized
- Updates proposal status to finalized
- Emits Finalize event

**Failure Cases:**
- Blocks finalization without sufficient votes
- Prevents non-token holders from finalizing
- Blocks re-finalization of completed proposals
- Prevents finalization of cancelled proposals

### Token Tests (12 tests)
- Complete ERC-20 functionality validation
- Transfer, approval, and allowance mechanics
- Error handling for invalid operations