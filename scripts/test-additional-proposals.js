const { ethers } = require('hardhat')
const config = require('../src/config.json')

async function main() {
  console.log(`Deploying additional test proposals...\n`)

  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()
  console.log(`Using chainId ${chainId}`)

  // Fetch contracts
  const token = await ethers.getContractAt('Token', config[chainId].token.address)
  const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)

  // Fetch accounts
  const accounts = await ethers.getSigners()
  const deployer = accounts[0]
  const investor1 = accounts[1]
  const investor2 = accounts[2]

  // Check token balances (tokens already distributed in seed.js)
  let balance = await token.balanceOf(deployer.address)
  console.log(`Deployer balance: ${ethers.utils.formatEther(balance)} tokens`)

  let investor1Balance = await token.balanceOf(investor1.address)
  console.log(`Investor1 balance: ${ethers.utils.formatEther(investor1Balance)} tokens`)

  let investor2Balance = await token.balanceOf(investor2.address)
  console.log(`Investor2 balance: ${ethers.utils.formatEther(investor2Balance)} tokens\n`)

  console.log(`Creating additional proposals...\n`)

  let transaction

  // Investor1 creates proposal 1
  transaction = await dao.connect(investor1).createProposal(
    'Community Development Fund |Test| Proposal',
    'Funding for community development initiatives and educational programs',
    ethers.utils.parseEther('33'),
    investor1.address
  )
  await transaction.wait()

  console.log(`Investor1 created proposal 1\n`)

  /* Note testing in this script using ethers.utils.parseEther('#') vs tokens(#) w/
      const tokens = (n) => {
          return ethers.utils.parseUnits(n.toString(), 'ether')
        }*/

  // Investor2 creates proposal 2 with deadline (7 days)
  const deadline1 = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days from now
  transaction = await dao.connect(investor2).createProposalWithDeadline(
    'Marketing Campaign |Test| Proposal',
    'Launch a comprehensive marketing campaign to increase DAO awareness',
    ethers.utils.parseEther('44'),
    investor2.address,
    deadline1
  )
  await transaction.wait()

  console.log(`Investor2 created proposal 2 with 7-day deadline\n`)

  // Deployer creates proposal 3 with deadline (14 days)
  const deadline2 = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60); // 14 days from now
  transaction = await dao.connect(deployer).createProposalWithDeadline(
    'Technical Infrastructure |Test| Proposal',
    'Upgrade technical infrastructure and development tools',
    ethers.utils.parseEther('55'),
    deployer.address,
    deadline2
  )
  await transaction.wait()

  console.log(`Deployer created proposal 3 with 14-day deadline\n`)

  // Get current proposal count to vote on the newly created proposals
  const proposalCount = await dao.proposalCount()
  console.log(`Current proposal count: ${proposalCount}`)

  console.log(`\nAdding voting activity...\n`)

  // Calculate proposal IDs (last 3 proposals created)
  const proposal1Id = proposalCount - 2
  const proposal2Id = proposalCount - 1
  // const proposal3Id = proposalCount

  // Deployer votes on the first new proposal
  transaction = await dao.connect(deployer)["vote(uint256,bool)"](proposal1Id, true) // Vote For
  await transaction.wait()
  console.log(`Deployer voted FOR proposal ${proposal1Id}`)

  // Investor1 votes on the second new proposal
  transaction = await dao.connect(investor1)["vote(uint256,bool)"](proposal2Id, true) // Vote For
  await transaction.wait()
  console.log(`Investor1 voted FOR proposal ${proposal2Id}`)

  // Investor2 votes on the first new proposal
  transaction = await dao.connect(investor2)["vote(uint256,bool)"](proposal1Id, false) // Vote Against
  await transaction.wait()
  console.log(`Investor2 voted AGAINST proposal ${proposal1Id}`)

  // Add some comments to the new proposals
  console.log(`\nAdding comments...\n`)

  transaction = await dao.connect(deployer).addComment(proposal1Id, "This proposal will greatly benefit our community!")
  await transaction.wait()
  console.log(`Deployer added comment to proposal ${proposal1Id}`)

  transaction = await dao.connect(investor1).addComment(proposal2Id, "Marketing is essential for growth")
  await transaction.wait()
  console.log(`Investor1 added comment to proposal ${proposal2Id}`)

  transaction = await dao.connect(investor2).addComment(proposalCount, "Infrastructure improvements are crucial")
  await transaction.wait()
  console.log(`Investor2 added comment to proposal ${proposalCount}`)

  console.log(`\n✓✓✓ Additional test proposals deployment complete! ✓✓✓`)
  console.log(`\n=== NEXT STEPS ===`)
  console.log(`1. Start the frontend: npm start`)
  console.log(`2. Connect your wallet and interact with the proposals`)
  console.log(`3. Test voting, commenting, and other features`)
  console.log(`\n✓✓✓ This completes the test proposal sequence ✓✓✓`)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
