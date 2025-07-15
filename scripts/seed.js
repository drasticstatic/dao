// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require('../src/config.json')
const { ethers } = hre

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

async function main() {
  console.log(`\nFetching accounts & network...\n`)

  const accounts = await ethers.getSigners()
  const funder = accounts[0]
  const investor1 = accounts[1]
  const investor2 = accounts[2]
  const investor3 = accounts[3]
  // const recipient = accounts[4]

  let transaction

  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()

  console.log(`Fetching token and transferring to accounts...\n`)

  // Fetch deployed token
  const token = await ethers.getContractAt('Token', config[chainId].token.address)
  console.log(`\u00A0✓ Token fetched: ${token.address}\n`)

  // Send tokens to investors - each one gets 20%
  transaction = await token.transfer(investor1.address, tokens(200000))
  await transaction.wait()

  transaction = await token.transfer(investor2.address, tokens(200000))
  await transaction.wait()

  transaction = await token.transfer(investor3.address, tokens(200000))
  await transaction.wait()

  console.log(`Fetching dao...\n`)
  // Fetch deployed dao
  const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
  console.log(`\u00A0✓ DAO fetched: ${dao.address}\n`)
  console.log("✓✓ Deployment complete! ✓✓\n")

  // Funder sends Ether to DAO treasury
  transaction = await funder.sendTransaction({ to: dao.address, value: ether(1000) }) // 1,000 Ether
  await transaction.wait()
  console.log(`\u00A0\u00A0✓ Sent funds to dao treasury...\n`)

    console.log(`\u00A0\u00A0✓✓✓ Seed.js is Complete! ✓✓✓\n`)
    console.log("\nNext steps: (optional to render test proposals)\n")
    console.log("\u00A0npx hardhat run scripts/test-initial-proposals.js --network...\n")
    console.log("\u00A0npx hardhat run scripts/test-abstain.js --network...\n")
    console.log("\u00A0npx hardhat run scripts/test-oppose.js --network...\n")
    console.log("\u00A0npx hardhat run scripts/test-ready-cancel.js --network...\n")
    console.log("\u00A0npx hardhat run scripts/test-ready finalize.js --network...\n")
    console.log("\u00A0npx hardhat run scripts/test-additional-proposals.js --network...\n")
    console.log(`\n=== CLEAN SLATE START ALTERNATIVE: ===`)
    console.log(`\u00A0For a clean DAO without test proposals:\n`)
    console.log(`\u00A0\u00A01. Skip all test scripts`)
    console.log(`\u00A0\u00A02. Start frontend: npm start`)
    console.log(`\u00A0\u00A03. Create your own proposals and test voting\n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
