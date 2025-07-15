const { ethers } = require('hardhat')
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

async function main() {
  console.log(`\nDeploying initial test proposals (1-4)...\n`)

  const accounts = await ethers.getSigners()
  // const funder = accounts[0]
  const investor1 = accounts[1]
  const investor2 = accounts[2]
  const investor3 = accounts[3]
  const recipient = accounts[4]

  let transaction

  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()

  console.log(`Fetching token and dao contracts...\n`)

  // Fetch deployed token
  const token = await ethers.getContractAt('Token', config[chainId].token.address)
  console.log(`✓ Token fetched: ${token.address}\n`)

  // Fetch deployed dao
  const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
  console.log(`✓ DAO fetched: ${dao.address}\n`)

  console.log(`Creating initial test proposals...\n`)

  // Create proposals 1-3 (auto-finalized)
  for (var i = 0; i < 3; i++) {
      // Create Proposal
        // All 3 investors vote in favor, then finalize each proposal
      transaction = await dao.connect(investor1).createProposal(
        `*Approved & Finalized* |Test| Proposal ${i + 1} - Deployed w/ Quorum=inFavor + Finalized`,
        `Proposals 1 thru 3 are tests where all 3 investors vote in favor with the proposal automatically finalized upon deployment`,
        ether(50), recipient.address)
      await transaction.wait()

      // Vote 1 - in favor
      transaction = await dao.connect(investor1)["vote(uint256,bool)"](i + 1, true)
      await transaction.wait()

      // Vote 2 - in favor
      transaction = await dao.connect(investor2)["vote(uint256,bool)"](i + 1, true)
      await transaction.wait()

      // Vote 3 - in favor
      transaction = await dao.connect(investor3)["vote(uint256,bool)"](i + 1, true)
      await transaction.wait()

      // Finalize
      transaction = await dao.connect(investor1).finalizeProposal(i + 1)
      await transaction.wait()

      console.log(`   ✓ Created & Finalized Proposal ${i + 1}\n`)
  }

    console.log(`   Creating Proposal 4 w/out meeting quorum & unfinalized...\n`)

    // Create a 4th proposal
      // Where only 2 investors vote (not enough for quorum)
        // Intentionally NOT finalized for user interaction
    transaction = await dao.connect(investor1).createProposal(
      `*Unfinished & Unfinalized* |Test| - Deployed w/ Quorum=notMet + notFinalized`,
      `Proposal 4 is intentionally not finalized so users can intially interact with it upon deployment`,
      ether(50), recipient.address)
    await transaction.wait()

    // Vote 1 - in favor
    transaction = await dao.connect(investor2)["vote(uint256,bool)"](4, true)
    await transaction.wait()

    // Vote 2 - in favor
    transaction = await dao.connect(investor3)["vote(uint256,bool)"](4, true)
    await transaction.wait()

    // Note: We intentionally do not finalize Proposal 4 so users can interact with it

    console.log(`   ✓✓✓ Initial test proposals complete! ✓✓✓\n`)
    console.log("Next steps:\n")
    console.log(" npx hardhat run scripts/test-abstain.js --network...\n")
    console.log(" npx hardhat run scripts/test-oppose.js --network...\n")
    console.log(" npx hardhat run scripts/test-ready-cancel.js --network...\n")
    console.log(" npx hardhat run scripts/test-ready finalize.js --network...\n")
    console.log(" npx hardhat run scripts/test-additional-proposals.js --network...\n")
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
