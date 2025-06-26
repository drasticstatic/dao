const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

describe('DAO', () => {
  let token, dao
  let deployer,
      funder,
      investor1, // also the proposer (creator of the proposal)
      investor2,
      investor3,
      investor4,
      investor5,
      recipient, // the recipient of the proposal funds
      user // a random user, not an investor/DOA member

  beforeEach(async () => {
    // Set up accounts
    let accounts = await ethers.getSigners()
    deployer = accounts[0]
    funder = accounts[1]
    investor1 = accounts[2]
    investor2 = accounts[3]
    investor3 = accounts[4]
    investor4 = accounts[5]
    investor5 = accounts[6]
    recipient = accounts[7]
    user = accounts[8]

    // Deploy Token
    const Token = await ethers.getContractFactory('Token')
    token = await Token.deploy('Dapp University', 'DAPP', '1000000')

    // Send tokens to investors - each one gets 20%
    transaction = await token.connect(deployer).transfer(investor1.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor2.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor3.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor4.address, tokens(200000))
    await transaction.wait()

    transaction = await token.connect(deployer).transfer(investor5.address, tokens(200000))
    await transaction.wait()

    // Deploy DAO:
    const DAO = await ethers.getContractFactory('DAO')
    dao = await DAO.deploy(token.address, '500000000000000000000001')
        // Set Quorum to > 50% of token total supply
          // 500k tokens + 1 wei, i.e., 500000000000000000000001

    // Funder -acct1 sends 100 Ether to DAO treasury for Governance
    await funder.sendTransaction({ to: dao.address, value: ether(100) })
  })


  describe('Deployment', () => {

    it('sends ether to the DAO treasury', async () => {
      expect(await ethers.provider.getBalance(dao.address)).to.equal(ether(100))
    })

    it('returns token address', async () => {
      expect(await dao.token()).to.equal(token.address)
    })

    it('returns quorum', async () => {
      expect(await dao.quorum()).to.equal('500000000000000000000001')
    })

  })

  describe('Proposal creation', () => {
    let transaction, result

    describe('Success', () => {

      beforeEach(async () => {
        transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description for proposal 1', ether(100), recipient.address)
        result = await transaction.wait()
      })

      it('updates proposal count', async () => {
        expect(await dao.proposalCount()).to.equal(1)
      }) // quantify the proposal mapping

      it('updates proposal mapping', async () => {
        const proposal = await dao.proposals(1) // fetch proposal by ID

        expect(proposal.id).to.equal(1)
        expect(proposal.amount).to.equal(ether(100))
        expect(proposal.recipient).to.equal(recipient.address)
      })

      it('emits a propose event', async () => {
        await expect(transaction).to.emit(dao, 'Propose')// check for the Propose event
          .withArgs(1, 'Proposal 1', 'Description for proposal 1', ether(100), recipient.address, investor1.address)
      })

    })

    describe('Failure', () => {
      it('rejects invalid amount', async () => {
        await expect(dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(1000), recipient.address)).to.be.reverted
      })

      it('reject non-investor', async () => {
        await expect(dao.connect(user).createProposal('Proposal 1', 'Description', ether(100), recipient.address)).to.be.revertedWith('must be token holder')
      })
    })
  })

  // Voting
  describe('Voting', () => {
    let transaction, result

    beforeEach(async () => {
      transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(100), recipient.address)
      result = await transaction.wait()
    })

    describe('Success', () => {

      beforeEach(async () => {
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()
      })

      it('updates vote count', async () => {
        const proposal = await dao.proposals(1)
        expect(proposal.positiveVotes).to.equal(tokens(200000))
      })

      it('emits vote event', async () => {
        await expect(transaction).to.emit(dao, "Vote")
          .withArgs(1, investor1.address, true)
      })

    })

    describe('Failure', () => {

      it('reject non-investor', async () => {
        await expect(dao.connect(user)["vote(uint256,bool)"](1, true)).to.be.revertedWith('must be token holder')
      }) // user does not hold any tokens

      it('rejects double voting', async () => {
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, true)
        await transaction.wait()

        await expect(dao.connect(investor1)["vote(uint256,bool)"](1, true)).to.be.revertedWith('already voted')
      })
    })
  })

  // Vote Against
  describe('Vote Against', () => {
    let transaction, result

    beforeEach(async () => {
      transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(100), recipient.address)
      result = await transaction.wait()
    })

    describe('Success', () => {

      beforeEach(async () => {
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, false)
        result = await transaction.wait()
      })

      it('updates negative vote count', async () => {
        const proposal = await dao.proposals(1)
        expect(proposal.negativeVotes).to.equal(tokens(200000))
      })

      it('updates net votes correctly', async () => {
        const proposal = await dao.proposals(1)
        expect(proposal.votes).to.equal(tokens(-200000))
      })

      it('emits vote event with false', async () => {
        await expect(transaction).to.emit(dao, "Vote")
          .withArgs(1, investor1.address, false)
      })

    })

  })

  // Proposal Cancellation
  describe('Proposal Cancellation', () => {
    let transaction, result

    beforeEach(async () => {
      // Create proposal
      transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(100), recipient.address)
      result = await transaction.wait()

      // Vote against with enough votes to reach quorum
      transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, false)
      result = await transaction.wait()

      transaction = await dao.connect(investor2)["vote(uint256,bool)"](1, false)
      result = await transaction.wait()

      transaction = await dao.connect(investor3)["vote(uint256,bool)"](1, false)
      result = await transaction.wait()
    })

    describe('Success', () => {

      beforeEach(async () => {
        transaction = await dao.connect(investor1).cancelProposal(1)
        result = await transaction.wait()
      })

      it('updates proposal to cancelled', async () => {
        const proposal = await dao.proposals(1)
        expect(proposal.cancelled).to.equal(true)
      })

      it('emits a Cancel event', async () => {
        await expect(transaction).to.emit(dao, "Cancel")
          .withArgs(1)
      })

    })

    describe('Failure', () => {

      it('rejects cancellation if not enough negative votes', async () => {
        // Create new proposal with insufficient negative votes
        transaction = await dao.connect(investor1).createProposal('Proposal 2', 'Description', ether(50), recipient.address)
        await transaction.wait()

        transaction = await dao.connect(investor1)["vote(uint256,bool)"](2, false)
        await transaction.wait()

        await expect(dao.connect(investor1).cancelProposal(2)).to.be.revertedWith('against votes must reach quorum to cancel proposal')
      })

      it('rejects cancellation from non-investor', async () => {
        await expect(dao.connect(user).cancelProposal(1)).to.be.revertedWith('must be token holder')
      })

      it('rejects cancellation if already cancelled', async () => {
        transaction = await dao.connect(investor1).cancelProposal(1)
        await transaction.wait()

        await expect(dao.connect(investor1).cancelProposal(1)).to.be.revertedWith('proposal already cancelled')
      })

    })

  })

  describe('Governance', () => {
    let transaction, result

    describe('Success', () => {

      beforeEach(async () => {
        // Create proposal
        transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(100), recipient.address)
        result = await transaction.wait()

        // Vote
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        transaction = await dao.connect(investor2)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        transaction = await dao.connect(investor3)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        // Finalize proposal
        transaction = await dao.connect(investor1).finalizeProposal(1)
        result = await transaction.wait()
      })

      it('transfers funds to recipient', async () => {
        expect(await ethers.provider.getBalance(recipient.address)).to.equal(tokens(10100))
      })

      it('it updates the proposal to finalized', async () => {
        const proposal = await dao.proposals(1)
        expect(proposal.finalized).to.equal(true)
      })

      it('emits a Finalize event', async () => {
        await expect(transaction).to.emit(dao, "Finalize")
          .withArgs(1)
      })

    })

    describe('Failure', () => {

      beforeEach(async () => {
        // Create proposal
        transaction = await dao.connect(investor1).createProposal('Proposal 1', 'Description', ether(100), recipient.address)
        result = await transaction.wait()

        // Vote
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        transaction = await dao.connect(investor2)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()
      })

      it('rejects finalization if not enough votes', async () => {
        await expect(dao.connect(investor1).finalizeProposal(1)).to.be.revertedWith('must reach quorum to finalize proposal')
      })

      it('rejects finalization from a non-investor', async () => {
        // Vote 3
        transaction = await dao.connect(investor3)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        await expect(dao.connect(user).finalizeProposal(1)).to.be.revertedWith('must be token holder')
      })

      it('rejects proposal if already finalized', async () => {
        // Vote 3
        transaction = await dao.connect(investor3)["vote(uint256,bool)"](1, true)
        result = await transaction.wait()

        // Finalize
        transaction = await dao.connect(investor1).finalizeProposal(1)
        result = await transaction.wait()

        // Try to finalize again
        await expect(dao.connect(investor1).finalizeProposal(1)).to.be.revertedWith('proposal already finalized')
      })

      it('rejects finalization of cancelled proposal', async () => {
        // Create new proposal
        transaction = await dao.connect(investor1).createProposal('Proposal 2', 'Description', ether(50), recipient.address)
        await transaction.wait()

        // Vote against to cancel
        transaction = await dao.connect(investor1)["vote(uint256,bool)"](2, false)
        await transaction.wait()
        transaction = await dao.connect(investor2)["vote(uint256,bool)"](2, false)
        await transaction.wait()
        transaction = await dao.connect(investor3)["vote(uint256,bool)"](2, false)
        await transaction.wait()

        // Cancel proposal
        transaction = await dao.connect(investor1).cancelProposal(2)
        await transaction.wait()

        // Try to finalize cancelled proposal
        await expect(dao.connect(investor1).finalizeProposal(2)).to.be.revertedWith('proposal was cancelled')
      })

    })
  })
})