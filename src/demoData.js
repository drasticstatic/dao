/**
 * demoData.js — Static demo proposals for GH Pages showcase
 *
 * Mirrors the full test seed sequence run on localhost:
 *   deploy.js → seed.js → test-initial-proposals.js → test-abstain.js
 *   → test-oppose.js → test-ready-cancel.js → test-ready-finalize.js
 *   → test-additional-proposals.js
 *
 * Data types match what App.js loads from the blockchain:
 *   - amount, votes, forVotes, againstVotes, abstainVotes, quorum → ethers BigNumber
 *   - id, deadline → ethers BigNumber
 *   - finalized, cancelled → boolean
 */

import { ethers } from 'ethers'

const pe = (n) => ethers.utils.parseEther(String(n))  // parseEther shorthand
const bn = (n) => ethers.BigNumber.from(String(n))
const neg = (bn) => ethers.BigNumber.from(0).sub(bn)

// Token distribution: 3 investors × 200,000 tokens each
const NONE        = bn(0)
const ONE_INV     = pe('200000')   // 1 investor voting
const TWO_INV     = pe('400000')   // 2 investors voting
const THREE_INV   = pe('600000')   // 3 investors voting (reaches quorum)

// Hardhat test account addresses (deterministic)
const RECIPIENT   = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
const INVESTOR1   = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const INVESTOR2   = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

// Quorum from deploy.js: '500000000000000000000001' (500,000.000...001 tokens)
export const DEMO_QUORUM = bn('500000000000000000000001')

// Treasury seeded with 1,000 ETH from seed.js
export const DEMO_TREASURY_BALANCE = '1000.0'

// Deadline helpers
const daysFromNow = (d) => bn(Math.floor(Date.now() / 1000) + d * 86400)

export const DEMO_PROPOSALS = [
  // ── Proposals 1–3 (test-initial-proposals.js) ──────────────────────────
  // All 3 investors voted for, then finalized
  {
    id: bn(1),
    name: '*Approved & Finalized* |Test| Proposal 1 - Deployed w/ Quorum=inFavor + Finalized',
    description: 'Proposals 1 thru 3 are tests where all 3 investors vote in favor with the proposal automatically finalized upon deployment',
    amount: pe('50'),
    recipient: RECIPIENT,
    votes: THREE_INV,
    forVotes: THREE_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: true,
    cancelled: false,
    deadline: NONE,
  },
  {
    id: bn(2),
    name: '*Approved & Finalized* |Test| Proposal 2 - Deployed w/ Quorum=inFavor + Finalized',
    description: 'Proposals 1 thru 3 are tests where all 3 investors vote in favor with the proposal automatically finalized upon deployment',
    amount: pe('50'),
    recipient: RECIPIENT,
    votes: THREE_INV,
    forVotes: THREE_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: true,
    cancelled: false,
    deadline: NONE,
  },
  {
    id: bn(3),
    name: '*Approved & Finalized* |Test| Proposal 3 - Deployed w/ Quorum=inFavor + Finalized',
    description: 'Proposals 1 thru 3 are tests where all 3 investors vote in favor with the proposal automatically finalized upon deployment',
    amount: pe('50'),
    recipient: RECIPIENT,
    votes: THREE_INV,
    forVotes: THREE_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: true,
    cancelled: false,
    deadline: NONE,
  },
  // ── Proposal 4 (test-initial-proposals.js) ──────────────────────────────
  // 2 investors voted for — quorum NOT met, not finalized (open for interaction)
  {
    id: bn(4),
    name: '*Unfinished & Unfinalized* |Test| - Deployed w/ Quorum=notMet + notFinalized',
    description: 'Proposal 4 is intentionally not finalized so users can initially interact with it upon deployment',
    amount: pe('50'),
    recipient: RECIPIENT,
    votes: TWO_INV,
    forVotes: TWO_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: NONE,
  },
  // ── Proposal 5 (test-abstain.js) ────────────────────────────────────────
  // 1 investor for, 1 abstain — quorum NOT met
  {
    id: bn(5),
    name: '*Abstaining & Unfinalized* |Test| - Deployed w/ Quorum=notMet + notFinalized',
    description: 'Testing the abstain voting functionality with mixed voting choices',
    amount: pe('40'),
    recipient: RECIPIENT,
    votes: ONE_INV,
    forVotes: ONE_INV,
    againstVotes: NONE,
    abstainVotes: ONE_INV,
    finalized: false,
    cancelled: false,
    deadline: NONE,
  },
  // ── Proposal 6 (test-oppose.js) ─────────────────────────────────────────
  // All 3 investors voted against → quorum met → CANCELLED
  {
    id: bn(6),
    name: '*Opposing & Cancelled* |Test| - Deployed w/ Quorum=Against + Cancelled',
    description: 'Testing oppose voting with enough negative votes to reach quorum and cancel',
    amount: pe('75'),
    recipient: RECIPIENT,
    votes: neg(THREE_INV),
    forVotes: NONE,
    againstVotes: THREE_INV,
    abstainVotes: NONE,
    finalized: false,
    cancelled: true,
    deadline: NONE,
  },
  // ── Proposal 7 (test-ready-cancel.js) ───────────────────────────────────
  // Enough against votes to reach quorum but NOT YET cancelled
  {
    id: bn(7),
    name: '*Ready for Cancellation* |Test| - Deployed w/ Quorum=✅ & Ready to Cancel 😞',
    description: 'Testing proposal with enough negative votes to meet quorum but not yet cancelled',
    amount: pe('90'),
    recipient: RECIPIENT,
    votes: neg(THREE_INV),
    forVotes: NONE,
    againstVotes: THREE_INV,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: NONE,
  },
  // ── Proposal 8 (test-ready-finalize.js) ─────────────────────────────────
  // Enough for votes to reach quorum but NOT YET finalized
  {
    id: bn(8),
    name: '*Ready for Finalization* |Test| - Deployed w/ Quorum=✅ & Ready to Finalize 🤩',
    description: 'Testing proposal with enough positive votes to meet quorum but not yet finalized',
    amount: pe('80'),
    recipient: RECIPIENT,
    votes: THREE_INV,
    forVotes: THREE_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: NONE,
  },
  // ── Proposals 9–11 (test-additional-proposals.js) ────────────────────────
  {
    id: bn(9),
    name: 'Community Development Fund |Test| Proposal',
    description: 'Funding for community development initiatives and educational programs',
    amount: pe('33'),
    recipient: INVESTOR1,
    votes: NONE,       // 1 for, 1 against → net 0
    forVotes: ONE_INV,
    againstVotes: ONE_INV,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: NONE,
  },
  {
    id: bn(10),
    name: 'Marketing Campaign |Test| Proposal',
    description: 'Launch a comprehensive marketing campaign to increase DAO awareness',
    amount: pe('44'),
    recipient: INVESTOR2,
    votes: ONE_INV,
    forVotes: ONE_INV,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: daysFromNow(7),
  },
  {
    id: bn(11),
    name: 'Technical Infrastructure |Test| Proposal',
    description: 'Upgrade technical infrastructure and development tools',
    amount: pe('55'),
    recipient: RECIPIENT,
    votes: NONE,
    forVotes: NONE,
    againstVotes: NONE,
    abstainVotes: NONE,
    finalized: false,
    cancelled: false,
    deadline: daysFromNow(14),
  },
]
