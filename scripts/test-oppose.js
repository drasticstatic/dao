const hre = require("hardhat");
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

async function main() {
  console.log(`\nTesting oppose voting functionality...\n`)

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

  // Create 6th proposal - will be cancelled
  console.log('Creating test proposal 6 for oppose voting (will be cancelled)...')
  let transaction = await dao.connect(investor1).createProposal(
    '*Opposing & Cancelled* |Test| - Deployed w/ Quorum=Against + Cancelled',
    'Testing oppose voting with enough negative votes to reach quorum and cancel',
    tokens(75),
    recipient.address
  )
  await transaction.wait()
  console.log('\u00A0✓ Test proposal 6 created\n')

  // Get proposal 6 ID
  let proposalCount = await dao.proposalCount()
  let proposalId6 = proposalCount.toNumber()
  console.log(`\u00A0Proposal 6 ID: ${proposalId6}`)

  // All 3 investors vote against proposal 6 (reaches quorum)
  console.log('\u00A0Testing oppose votes to reach quorum...')
  transaction = await dao.connect(investor1)["vote(uint256,bool)"](proposalId6, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 1 voted against')

  transaction = await dao.connect(investor2)["vote(uint256,bool)"](proposalId6, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 2 voted against')

  transaction = await dao.connect(investor3)["vote(uint256,bool)"](proposalId6, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 3 voted against')

  // Cancel the proposal
  console.log('\u00A0Cancelling proposal 6...')
  transaction = await dao.connect(investor1).cancelProposal(proposalId6)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Proposal 6 cancelled')

  // Create 7th proposal - will have oppose votes but not enough for quorum
  console.log('\nCreating test proposal 7 for oppose voting (insufficient for cancellation)...')
  transaction = await dao.connect(investor1).createProposal(
    '*Opposing & Unfinished* |Test| - Deployed w/ Quorum=notMet + notCancelled',
    'Testing oppose voting with insufficient negative votes (quorum not met)',
    tokens(60),
    recipient.address
  )
  await transaction.wait()
  console.log('\u00A0✓ Test proposal 7 created\n')

  // Get proposal 7 ID
  proposalCount = await dao.proposalCount()
  let proposalId7 = proposalCount.toNumber()
  console.log(`\u00A0Proposal 7 ID: ${proposalId7}`)

  // Only 2 investors vote against proposal 7 (doesn't reach quorum)
  console.log('\u00A0Testing oppose votes without reaching quorum...')
  transaction = await dao.connect(investor2)["vote(uint256,bool)"](proposalId7, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 2 voted against')

  transaction = await dao.connect(investor3)["vote(uint256,bool)"](proposalId7, false)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Investor 3 voted against')

  // Check both proposals' states (simplified version)
  const proposal6 = await dao.proposals(proposalId6)
  const proposal7 = await dao.proposals(proposalId7)

  console.log('\nProposal 6 Results (Cancelled):')
  console.log(`\u00A0- Net votes: ${ethers.utils.formatEther(proposal6.votes)} ETH`)
  console.log(`\u00A0- Name: ${proposal6.name}`)
  console.log(`\u00A0- Cancelled: ${proposal6.cancelled}`)
  console.log(`\u00A0- Finalized: ${proposal6.finalized}`)

  console.log('\nProposal 7 Results (Active):')
  console.log(`\u00A0- Net votes: ${ethers.utils.formatEther(proposal7.votes)} ETH`)
  console.log(`\u00A0- Name: ${proposal7.name}`)
  console.log(`\u00A0- Cancelled: ${proposal7.cancelled}`)
  console.log(`\u00A0- Finalized: ${proposal7.finalized}`)

  console.log('\n✓✓ Oppose voting test completed successfully! ✓✓\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
