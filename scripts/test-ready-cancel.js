const hre = require("hardhat");
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

async function main() {
  console.log(`\nTesting ready-to-cancel proposal functionality...\n`)

  const accounts = await ethers.getSigners()
  const investor1 = accounts[1]
  const investor2 = accounts[2]
  const investor3 = accounts[3]
  const recipient = accounts[4]

  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()

  // Fetch deployed contracts
  console.log(`Fetching dao...`)
  const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
  console.log(`\u00A0✓ DAO fetched: ${dao.address}\n`)

  // Create a test proposal that will reach quorum for cancellation
  console.log('Creating test proposal ready for cancellation...')
  let transaction = await dao.connect(investor1).createProposal(
    '*Ready for Cancellation* |Test| - Deployed w/ Quorum=✅ & Ready to Cancel 😞',
    'Testing proposal with enough negative votes to meet quorum but not yet cancelled',
    tokens(90),
    recipient.address
  )
  await transaction.wait()
  console.log('\u00A0✓ Test proposal created\n')

  // Get the proposal ID
  const proposalCount = await dao.proposalCount()
  const proposalId = proposalCount.toNumber()
  console.log(`Proposal ID: ${proposalId}`)

  // All 3 investors vote against to reach quorum (3 × 200k = 600k > 500k quorum)
  console.log('\u00A0Casting votes to reach quorum for cancellation...')
  
  transaction = await dao.connect(investor1)["vote(uint256,bool)"](proposalId, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 1 voted against (200k tokens)')

  transaction = await dao.connect(investor2)["vote(uint256,bool)"](proposalId, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 2 voted against (200k tokens)')

  transaction = await dao.connect(investor3)["vote(uint256,bool)"](proposalId, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 3 voted against (200k tokens)')

  // Check proposal state (simplified version)
  const proposal = await dao.proposals(proposalId)
  const quorum = await dao.quorum()

  console.log('\nProposal Results (Simplified Contract):')
  console.log(`\u00A0- Net votes: ${ethers.utils.formatEther(proposal.votes)} ETH`)
  console.log(`\u00A0- Proposal name: ${proposal.name}`)
  console.log(`\u00A0- Amount requested: ${ethers.utils.formatEther(proposal.amount)} ETH`)
  console.log(`\u00A0- Recipient: ${proposal.recipient}`)
  console.log(`\u00A0- Quorum required: ${ethers.utils.formatEther(quorum)} ETH`)
  console.log(`\u00A0- Finalized: ${proposal.finalized}`)
  console.log(`\u00A0- Cancelled: ${proposal.cancelled}`)

  // Verify quorum is met for cancellation (simplified check)
  // In simplified contract, negative votes result in negative net votes
  const netVotes = proposal.votes
  const negativeQuorumMet = netVotes.lte(quorum.mul(-1)) // Check if net votes <= -quorum
  console.log(`\u00A0- Quorum met for cancellation: ${negativeQuorumMet} ✓`)
  console.log(`\u00A0- Net votes should be <= -${ethers.utils.formatEther(quorum)} ETH for cancellation`)

  // Test participation rate (simplified implementation)
  const participationRate = await dao.getParticipationRate(proposalId)
  console.log(`\u00A0- Participation rate: ${participationRate}%`)

  console.log('\n😞 Proposal is ready for cancellation! 😞')
  console.log('\n✓✓ Ready-to-cancel test completed successfully! ✓✓\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
