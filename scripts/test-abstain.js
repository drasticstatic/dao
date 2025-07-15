const hre = require("hardhat");
const config = require('../src/config.json')
const { ethers } = hre

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

async function main() {
  console.log(`\nTesting abstain voting functionality...\n`)

  const accounts = await ethers.getSigners()
  const investor1 = accounts[1]
  const investor2 = accounts[2]
  const recipient = accounts[4]

  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()

  // Fetch deployed contracts
  console.log(`Fetching dao...`)
  const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
  console.log(`\u00A0✓ DAO fetched: ${dao.address}\n`)

  // Create a test proposal
  console.log('Creating test proposal for abstain voting...')
  let transaction = await dao.connect(investor1).createProposal(
    '*Abstaining & Unfinalized* |Test| - Deployed w/ Quorum=notMet + notFinalized',
    'Testing the abstain voting functionality with mixed voting choices',
    tokens(40),
    recipient.address
  )
  await transaction.wait()
  console.log('\u00A0✓ Test proposal created\n')

  // Get the proposal ID (should be 5 since we have 4 from seed)
  const proposalCount = await dao.proposalCount()
  const proposalId = proposalCount.toNumber()
  console.log(`Proposal ID: ${proposalId}`)

  // Test abstain vote (choice = 2)
  console.log('\u00A0Testing abstain vote...')
  transaction = await dao.connect(investor1)["vote(uint256,int8)"](proposalId, 2)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Abstain vote cast')

  // Test regular vote for comparison
  console.log('\u00A0Testing regular vote for comparison...')
  transaction = await dao.connect(investor2)["vote(uint256,bool)"](proposalId, true)
  await transaction.wait()
  console.log('\u00A0\u00A0✓ Regular vote cast')

  // Check proposal state (simplified version)
  const proposal = await dao.proposals(proposalId)
  console.log('\nProposal Results:')
  console.log(`\u00A0- Net votes: ${ethers.utils.formatEther(proposal.votes)} ETH`)
  console.log(`\u00A0- Proposal ID: ${proposal.id}`)
  console.log(`\u00A0- Name: ${proposal.name}`)
  console.log(`\u00A0- Amount: ${ethers.utils.formatEther(proposal.amount)} ETH`)
  console.log(`\u00A0- Finalized: ${proposal.finalized}`)
  console.log(`\u00A0- Cancelled: ${proposal.cancelled}`)

  // Test participation rate (simplified implementation)
  const participationRate = await dao.getParticipationRate(proposalId)
  console.log(`\u00A0- Participation rate: ${participationRate}%`)

  console.log('\n✓✓ Abstain voting test completed successfully! ✓✓\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
