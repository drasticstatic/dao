const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DAO Community Features', () => {
  let token, dao, deployer, investor1, investor2, investor3, recipient;

  beforeEach(async () => {
    // Get signers
    [deployer, investor1, investor2, investor3, recipient] = await ethers.getSigners();

    // Deploy Token contract
    const Token = await ethers.getContractFactory('Token');
    token = await Token.deploy('Dapp University', 'DAPP', '1000000');

    // Distribute tokens to create different voting power levels
    await token.connect(deployer).transfer(investor1.address, ethers.utils.parseUnits('300000', 'ether')); // High voting power
    await token.connect(deployer).transfer(investor2.address, ethers.utils.parseUnits('150000', 'ether')); // Medium voting power
    await token.connect(deployer).transfer(investor3.address, ethers.utils.parseUnits('50000', 'ether'));  // Low voting power

    // Deploy DAO contract
    const DAO = await ethers.getContractFactory('DAO');
    dao = await DAO.deploy(token.address, ethers.utils.parseUnits('200000', 'ether')); // Lower quorum for testing

    // Send Ether to DAO treasury (reduced amount for gas efficiency)
    await deployer.sendTransaction({
      to: dao.address,
      value: ethers.utils.parseEther('10')
    });
  });

  describe('Voting Power and Participation', () => {
    it('Should reflect different voting powers correctly', async () => {
      const balance1 = await token.balanceOf(investor1.address);
      const balance2 = await token.balanceOf(investor2.address);
      const balance3 = await token.balanceOf(investor3.address);

      expect(balance1).to.equal(ethers.utils.parseUnits('300000', 'ether'));
      expect(balance2).to.equal(ethers.utils.parseUnits('150000', 'ether'));
      expect(balance3).to.equal(ethers.utils.parseUnits('50000', 'ether'));
    });

    it('Should track participation across multiple proposals', async () => {
      // Create multiple proposals
      await dao.connect(investor1).createProposal(
        'Proposal 1', 'First test proposal', ethers.utils.parseEther('1'), recipient.address
      );

      await dao.connect(investor1).createProposal(
        'Proposal 2', 'Second test proposal', ethers.utils.parseEther('2'), recipient.address
      );

      // Different participation patterns
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);  // investor1 votes on proposal 1
      await dao.connect(investor2)['vote(uint256,int8)'](1, 1);  // investor2 votes on proposal 1
      
      await dao.connect(investor1)['vote(uint256,int8)'](2, -1); // investor1 votes on proposal 2
      await dao.connect(investor3)['vote(uint256,int8)'](2, 2);  // investor3 votes on proposal 2

      // Check participation tracking
      const proposal1 = await dao.proposals(1);
      const proposal2 = await dao.proposals(2);

      // Calculate total participation from separate mappings
      const proposal1ForVotes = await dao.proposalForVotes(1);
      const proposal1AgainstVotes = await dao.proposalAgainstVotes(1);
      const proposal1AbstainVotes = await dao.proposalAbstainVotes(1);
      const proposal1Participation = proposal1ForVotes.add(proposal1AgainstVotes).add(proposal1AbstainVotes);

      const proposal2ForVotes = await dao.proposalForVotes(2);
      const proposal2AgainstVotes = await dao.proposalAgainstVotes(2);
      const proposal2AbstainVotes = await dao.proposalAbstainVotes(2);
      const proposal2Participation = proposal2ForVotes.add(proposal2AgainstVotes).add(proposal2AbstainVotes);

      expect(proposal1Participation).to.equal(ethers.utils.parseUnits('450000', 'ether')); // investor1 + investor2
      expect(proposal2Participation).to.equal(ethers.utils.parseUnits('350000', 'ether')); // investor1 + investor3
    });
  });

  describe('Vote Distribution Analysis', () => {
    beforeEach(async () => {
      // Create a test proposal
      await dao.connect(investor1).createProposal(
        'Distribution Test', 'Testing vote distribution', ethers.utils.parseEther('1'), recipient.address
      );
    });

    it('Should track different vote types correctly', async () => {
      // Different vote types
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);  // For (300k tokens)
      await dao.connect(investor2)['vote(uint256,int8)'](1, -1); // Against (150k tokens)
      await dao.connect(investor3)['vote(uint256,int8)'](1, 2);  // Abstain (50k tokens)

      const proposal = await dao.proposals(1);
      
      // Check separate vote mappings
      const forVotes = await dao.proposalForVotes(1);
      const againstVotes = await dao.proposalAgainstVotes(1);
      const abstainVotes = await dao.proposalAbstainVotes(1);

      expect(forVotes).to.equal(ethers.utils.parseUnits('300000', 'ether'));
      expect(againstVotes).to.equal(ethers.utils.parseUnits('150000', 'ether'));
      expect(abstainVotes).to.equal(ethers.utils.parseUnits('50000', 'ether'));
      // Calculate total participation from separate mappings
      const totalForVotes = await dao.proposalForVotes(1);
      const totalAgainstVotes = await dao.proposalAgainstVotes(1);
      const totalAbstainVotes = await dao.proposalAbstainVotes(1);
      const totalParticipation = totalForVotes.add(totalAgainstVotes).add(totalAbstainVotes);
      expect(totalParticipation).to.equal(ethers.utils.parseUnits('500000', 'ether'));
    });

    it('Should calculate net votes correctly', async () => {
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);  // +300k
      await dao.connect(investor2)['vote(uint256,int8)'](1, -1); // -150k
      // investor3 doesn't vote

      const proposal = await dao.proposals(1);
      expect(proposal.votes).to.equal(ethers.utils.parseUnits('150000', 'ether')); // 300k - 150k = 150k
    });
  });

  describe('Quorum and Finalization Scenarios', () => {
    it('Should finalize proposal when positive votes reach quorum', async () => {
      await dao.connect(investor1).createProposal(
        'Finalization Test', 'Testing finalization', ethers.utils.parseEther('1'), recipient.address
      );

      // investor1 (300k) votes for - exceeds quorum (200k)
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);

      // Should be able to finalize
      await dao.connect(investor1).finalizeProposal(1);
      
      const proposal = await dao.proposals(1);
      expect(proposal.finalized).to.equal(true);
    });

    it('Should cancel proposal when negative votes reach quorum', async () => {
      await dao.connect(investor1).createProposal(
        'Cancellation Test', 'Testing cancellation', ethers.utils.parseEther('1'), recipient.address
      );

      // investor1 (300k) votes against - exceeds quorum (200k)
      await dao.connect(investor1)['vote(uint256,int8)'](1, -1);

      // Should be able to cancel
      await dao.connect(investor1).cancelProposal(1);
      
      const proposal = await dao.proposals(1);
      expect(proposal.cancelled).to.equal(true);
    });

    it('Should not finalize without reaching quorum', async () => {
      await dao.connect(investor1).createProposal(
        'Insufficient Votes', 'Testing insufficient votes', ethers.utils.parseEther('1'), recipient.address
      );

      // Only investor3 (50k) votes - below quorum (200k)
      await dao.connect(investor3)['vote(uint256,int8)'](1, 1);

      await expect(
        dao.connect(investor1).finalizeProposal(1)
      ).to.be.revertedWith('must reach quorum to finalize proposal');
    });
  });

  describe('Multiple Proposal Scenarios', () => {
    it('Should handle multiple active proposals correctly', async () => {
      // Create multiple proposals
      for (let i = 1; i <= 3; i++) {
        await dao.connect(investor1).createProposal(
          `Proposal ${i}`, `Description ${i}`, ethers.utils.parseEther('1'), recipient.address
        );
      }

      // Vote on different proposals
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);   // Vote for proposal 1
      await dao.connect(investor2)['vote(uint256,int8)'](2, -1);  // Vote against proposal 2
      await dao.connect(investor3)['vote(uint256,int8)'](3, 2);   // Abstain on proposal 3

      // Check each proposal independently
      const proposal1 = await dao.proposals(1);
      const proposal2 = await dao.proposals(2);
      const proposal3 = await dao.proposals(3);

      // Check separate vote mappings for each proposal
      const proposal1ForVotes = await dao.proposalForVotes(1);
      const proposal2AgainstVotes = await dao.proposalAgainstVotes(2);
      const proposal3AbstainVotes = await dao.proposalAbstainVotes(3);

      expect(proposal1ForVotes).to.equal(ethers.utils.parseUnits('300000', 'ether'));
      expect(proposal2AgainstVotes).to.equal(ethers.utils.parseUnits('150000', 'ether'));
      expect(proposal3AbstainVotes).to.equal(ethers.utils.parseUnits('50000', 'ether'));
    });

    it('Should prevent double voting on same proposal', async () => {
      await dao.connect(investor1).createProposal(
        'Double Vote Test', 'Testing double voting prevention', ethers.utils.parseEther('1'), recipient.address
      );

      // First vote should succeed
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);

      // Second vote should fail
      await expect(
        dao.connect(investor1)['vote(uint256,int8)'](1, -1)
      ).to.be.revertedWith('already voted');
    });

    it('Should allow same user to vote on different proposals', async () => {
      // Create two proposals
      await dao.connect(investor1).createProposal(
        'Proposal A', 'First proposal', ethers.utils.parseEther('1'), recipient.address
      );
      await dao.connect(investor1).createProposal(
        'Proposal B', 'Second proposal', ethers.utils.parseEther('2'), recipient.address
      );

      // Should be able to vote on both
      await dao.connect(investor1)['vote(uint256,int8)'](1, 1);  // Vote for proposal 1
      await dao.connect(investor1)['vote(uint256,int8)'](2, -1); // Vote against proposal 2

      const hasVoted1 = await dao.hasVoted(investor1.address, 1);
      const hasVoted2 = await dao.hasVoted(investor1.address, 2);

      expect(hasVoted1).to.equal(true);
      expect(hasVoted2).to.equal(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('Should reject votes from non-token holders', async () => {
      await dao.connect(investor1).createProposal(
        'Token Holder Test', 'Testing token holder requirement', ethers.utils.parseEther('1'), recipient.address
      );

      // recipient has no tokens
      await expect(
        dao.connect(recipient)['vote(uint256,int8)'](1, 1)
      ).to.be.revertedWith('must be token holder');
    });

    it('Should reject invalid vote choices', async () => {
      await dao.connect(investor1).createProposal(
        'Invalid Vote Test', 'Testing invalid vote choices', ethers.utils.parseEther('1'), recipient.address
      );

      // Invalid vote choice (not 1, -1, or 2)
      await expect(
        dao.connect(investor1)['vote(uint256,int8)'](1, 5)
      ).to.be.revertedWith('invalid choice');
    });
  });
});
