const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DAO Deadline Features', () => {
  let token, dao, deployer, investor1, investor2, investor3, recipient;
  let proposalCount = 0;

  beforeEach(async () => {
    // Get signers
    [deployer, investor1, investor2, investor3, recipient] = await ethers.getSigners();

    // Deploy Token contract
    const Token = await ethers.getContractFactory('Token');
    token = await Token.deploy('Dapp University', 'DAPP', '1000000');

    // Send tokens to investors
    let transaction = await token.connect(deployer).transfer(investor1.address, ethers.utils.parseUnits('200000', 'ether'));
    await transaction.wait();

    transaction = await token.connect(deployer).transfer(investor2.address, ethers.utils.parseUnits('200000', 'ether'));
    await transaction.wait();

    transaction = await token.connect(deployer).transfer(investor3.address, ethers.utils.parseUnits('150000', 'ether'));
    await transaction.wait();

    // Deploy DAO contract
    const DAO = await ethers.getContractFactory('DAO');
    dao = await DAO.deploy(token.address, ethers.utils.parseUnits('500000', 'ether'));

    // Send Ether to DAO treasury (reduced amount for gas efficiency)
    transaction = await deployer.sendTransaction({
      to: dao.address,
      value: ethers.utils.parseEther('10')
    });
    await transaction.wait();
  });

  describe('Proposal Creation with Deadlines', () => {
    it('Should create proposal with deadline', async () => {
      // Create deadline 1 hour from now
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const transaction = await dao.connect(investor1).createProposalWithDeadline(
        'Test Proposal with Deadline',
        'A proposal to test deadline functionality',
        ethers.utils.parseEther('1'),
        recipient.address,
        deadline
      );
      await transaction.wait();

      proposalCount++;
      const proposal = await dao.proposals(proposalCount);

      expect(proposal.name).to.equal('Test Proposal with Deadline');
      expect(proposal.deadline).to.equal(deadline);
    });

    it('Should create proposal without deadline', async () => {
      const transaction = await dao.connect(investor1).createProposal(
        'Test Proposal No Deadline',
        'A proposal without deadline',
        ethers.utils.parseEther('1'),
        recipient.address
      );
      await transaction.wait();

      const currentCount = await dao.proposalCount();
      const proposal = await dao.proposals(currentCount);

      expect(proposal.name).to.equal('Test Proposal No Deadline');
      expect(proposal.deadline).to.equal(0);
    });

    it('Should reject proposal with past deadline', async () => {
      // Create deadline in the past
      const pastDeadline = Math.floor(Date.now() / 1000) - 3600;

      await expect(
        dao.connect(investor1).createProposalWithDeadline(
          'Invalid Proposal',
          'A proposal with past deadline',
          ethers.utils.parseEther('1'),
          recipient.address,
          pastDeadline
        )
      ).to.be.revertedWith('deadline must be in the future or zero for no deadline');
    });
  });

  describe('Voting with Deadlines', () => {
    beforeEach(async () => {
      // Create a proposal with deadline for testing
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const transaction = await dao.connect(investor1).createProposalWithDeadline(
        'Deadline Test Proposal',
        'Testing voting with deadline',
        ethers.utils.parseEther('1'),
        recipient.address,
        deadline
      );
      await transaction.wait();
      proposalCount++;
    });

    it('Should allow voting before deadline', async () => {
      const transaction = await dao.connect(investor2)['vote(uint256,int8)'](proposalCount, 1);
      await transaction.wait();

      const hasVoted = await dao.hasVoted(investor2.address, proposalCount);
      expect(hasVoted).to.equal(true);
    });

    it('Should reject voting after deadline', async () => {
      // Get current block timestamp and add a short deadline
      const currentBlock = await ethers.provider.getBlock('latest');
      const shortDeadline = currentBlock.timestamp + 5; // 5 seconds from current block

      const transaction = await dao.connect(investor1).createProposalWithDeadline(
        'Short Deadline Proposal',
        'Testing expired deadline',
        ethers.utils.parseEther('1'),
        recipient.address,
        shortDeadline
      );
      await transaction.wait();

      // Get the actual proposal count from contract
      const currentProposalCount = await dao.proposalCount();

      // Mine a few blocks to advance time past deadline
      await ethers.provider.send("evm_increaseTime", [15]); // Increase time by 15 seconds (more than the 5 second deadline)
      await ethers.provider.send("evm_mine", []); // Mine a block to apply the time change

      // Verify the deadline has passed by checking the proposal
      const proposal = await dao.proposals(currentProposalCount);
      const latestBlock = await ethers.provider.getBlock('latest');
      // Ensure deadline has passed
      expect(latestBlock.timestamp).to.be.greaterThan(proposal.deadline);

      // Try to vote after deadline
      await expect(
        dao.connect(investor2)['vote(uint256,int8)'](currentProposalCount, 1)
      ).to.be.revertedWith('voting deadline has passed');
    });

    it('Should allow voting on proposals without deadline', async () => {
      // Create proposal without deadline
      const transaction = await dao.connect(investor1).createProposal(
        'No Deadline Proposal',
        'Testing voting without deadline',
        ethers.utils.parseEther('1'),
        recipient.address
      );
      await transaction.wait();
      proposalCount++;

      // Should be able to vote anytime
      const voteTransaction = await dao.connect(investor2)['vote(uint256,int8)'](proposalCount, 1);
      await voteTransaction.wait();

      const hasVoted = await dao.hasVoted(investor2.address, proposalCount);
      expect(hasVoted).to.equal(true);
    });
  });

  describe('Enhanced Voting Features', () => {
    beforeEach(async () => {
      const transaction = await dao.connect(investor1).createProposal(
        'Enhanced Voting Test',
        'Testing enhanced voting features',
        ethers.utils.parseEther('1'),
        recipient.address
      );
      await transaction.wait();
      proposalCount++;
    });

    it('Should track positive votes correctly', async () => {
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, 1); // Vote for

      const forVotes = await dao.proposalForVotes(proposalCount);
      expect(forVotes).to.equal(ethers.utils.parseUnits('200000', 'ether'));
    });

    it('Should track negative votes correctly', async () => {
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, -1); // Vote against

      const againstVotes = await dao.proposalAgainstVotes(proposalCount);
      expect(againstVotes).to.equal(ethers.utils.parseUnits('200000', 'ether'));
    });

    it('Should track abstain votes correctly', async () => {
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, 2); // Abstain

      const abstainVotes = await dao.proposalAbstainVotes(proposalCount);
      expect(abstainVotes).to.equal(ethers.utils.parseUnits('200000', 'ether'));
    });

    it('Should track total participation correctly', async () => {
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, 1); // Vote for
      await dao.connect(investor2)['vote(uint256,int8)'](proposalCount, -1); // Vote against

      const forVotes = await dao.proposalForVotes(proposalCount);
      const againstVotes = await dao.proposalAgainstVotes(proposalCount);
      const abstainVotes = await dao.proposalAbstainVotes(proposalCount);
      const totalParticipation = forVotes.add(againstVotes).add(abstainVotes);
      expect(totalParticipation).to.equal(ethers.utils.parseUnits('400000', 'ether'));
    });
  });

  describe('Proposal Cancellation', () => {
    beforeEach(async () => {
      const transaction = await dao.connect(investor1).createProposal(
        'Cancellation Test',
        'Testing proposal cancellation',
        ethers.utils.parseEther('1'),
        recipient.address
      );
      await transaction.wait();
      proposalCount++;
    });

    it('Should allow cancellation when negative votes reach quorum', async () => {
      // All three investors vote against (200k + 200k + 150k = 550k tokens > 500k quorum)
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, -1);
      await dao.connect(investor2)['vote(uint256,int8)'](proposalCount, -1);
      await dao.connect(investor3)['vote(uint256,int8)'](proposalCount, -1);

      // Cancel the proposal
      await dao.connect(investor1).cancelProposal(proposalCount);

      const proposal = await dao.proposals(proposalCount);
      expect(proposal.cancelled).to.equal(true);
    });

    it('Should reject cancellation without sufficient negative votes', async () => {
      // Only one investor votes against (200k tokens < 500k quorum)
      await dao.connect(investor1)['vote(uint256,int8)'](proposalCount, -1);

      await expect(
        dao.connect(investor1).cancelProposal(proposalCount)
      ).to.be.revertedWith('must reach quorum to cancel proposal');
    });
  });
});
