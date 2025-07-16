// ========== PROPOSALS.JS ==========

// Import necessary React hooks and Bootstrap components
import { useState, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import Modal from 'react-bootstrap/Modal';
import { ethers } from 'ethers';
import ParticipationProgress from './ParticipationProgress';
import { syncVoteHistoryFromBlockchain } from '../utils/blockchainSync';

/**
 * Proposals Component - Displays and manages DAO proposals
 *
 * @param {Object} provider - Ethereum provider from ethers.js
 * @param {Object} dao - DAO contract instance
 * @param {Array} proposals - List of proposals from the blockchain
 * @param {BigNumber} quorum - Minimum votes required to pass a proposal
 * @param {Function} setIsLoading - Function to update loading state in parent component
 */
const Proposals = ({ provider, dao, proposals, quorum, setIsLoading, loadBlockchainData, proposalCreationSuccess, setProposalCreationSuccess }) => {
  // State variables to track UI states and user data
  const [votingProposalId, setVotingProposalId] = useState(null); // Tracks which proposal is being voted on
  const [finalizingProposalId, setFinalizingProposalId] = useState(null); // Tracks which proposal is being finalized
  const [cancellingProposalId, setCancellingProposalId] = useState(null); // Tracks which proposal is being cancelled

  const [userVotes, setUserVotes] = useState({});/* Vote tracking with state:
    we use this to store votes from blockchain verification
      being more reliable than localStorage as it's always in sync with the blockchain*/

  const [recipientBalances, setRecipientBalances] = useState({});
  // Removed abstainVotesData - now using proposal.abstainVotes directly from contract

  // Enhanced voting features
  const [userVoteHistory, setUserVoteHistory] = useState(() => {
    // Load vote history from localStorage on component mount
    try {
      const saved = localStorage.getItem('daoVoteHistory');
      if (saved) {
        const data = JSON.parse(saved);
        // Migrate old vote data: convert type "2" to "0" for abstain
        Object.keys(data).forEach(proposalId => {
          if (data[proposalId].type === 'Abstain' && typeof data[proposalId].voteValue === 'undefined') {
            // Add voteValue for old abstain votes
            data[proposalId].voteValue = 0;
          }
        });
        return data;
      }
      return {};
    } catch (error) {
      console.error('Error loading vote history from localStorage:', error);
      return {};
    }
  });
  const [userTokenBalance, setUserTokenBalance] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [blockchainVotingData, setBlockchainVotingData] = useState({});

  // Community engagement features with local storage persistence
  const [showCommunityStats, setShowCommunityStats] = useState(() => {
    const saved = localStorage.getItem('dao-showCommunityStats');
    return saved ? JSON.parse(saved) : false; // Default to false on first load
  });
  const [showLeaderboard, setShowLeaderboard] = useState(() => {
    const saved = localStorage.getItem('dao-showLeaderboard');
    return saved ? JSON.parse(saved) : false; // Default to false on first load
  });
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedProposalForComments, setSelectedProposalForComments] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(() => {
    const saved = localStorage.getItem('dao-showAnalytics');
    return saved ? JSON.parse(saved) : false; // Default to false on first load
  });
  const [userAddress, setUserAddress] = useState('');
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  // On-chain comments state
  const [proposalComments, setProposalComments] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);

  // Legacy localStorage comments (for privacy option)
  const [localComments, setLocalComments] = useState(() => {
    try {
      const saved = localStorage.getItem('daoProposalComments');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      return {};
    }
  });
  const [useOnChainComments, setUseOnChainComments] = useState(true);

  // Removed userVotes logging useEffect to prevent performance issues
  /*useEffect(() => {
    console.log('Current userVotes state:', userVotes);
  }, [userVotes]);// Log userVotes whenever it changes*/

  // Load user token balance
  useEffect(() => {
    const loadUserTokenBalance = async () => {
      if (provider && dao) {
        try {
          const signer = await provider.getSigner();
          const userAddress = await signer.getAddress();

          // Get token address from DAO contract
          const tokenAddress = await dao.token();

          // Create token contract instance using ethers.Contract
          const tokenABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
          ];
          const token = new ethers.Contract(tokenAddress, tokenABI, provider);

          const balance = await token.balanceOf(userAddress);
          setUserTokenBalance(ethers.utils.formatEther(balance));
        } catch (error) {
          console.error('Error loading user token balance:', error);
          setUserTokenBalance(0);
        }
      }
    };
    loadUserTokenBalance();
  }, [provider, dao]);

  // Get user address for comment attribution
  useEffect(() => {
    const getUserAddress = async () => {
      if (provider) {
        try {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setUserAddress(address);

          // Load vote history (blockchain sync with fallback)
          if (dao && address) {
            try {
              // console.log('🔄 Loading vote history...'); // Removed to reduce console noise
              await syncVoteHistoryFromBlockchain(dao, provider, address);

              // Reload user vote history after sync
              const updatedHistory = JSON.parse(localStorage.getItem('daoVoteHistory') || '{}');
              setUserVoteHistory(updatedHistory);

              // console.log('✅ Vote history loaded successfully'); // Removed to reduce console noise
            } catch (syncError) {
              console.warn('⚠️ Using localStorage fallback:', syncError);
              // Fallback to localStorage only
              const updatedHistory = JSON.parse(localStorage.getItem('daoVoteHistory') || '{}');
              setUserVoteHistory(updatedHistory);
            }
          }
        } catch (error) {
          console.error('Error getting user address:', error);
        }
      }
    };
    getUserAddress();
  }, [provider, dao]);

  // Load comment counts for all proposals when proposals change
  useEffect(() => {
    const loadAllCommentCounts = async () => {
      if (!dao || !proposals) return;

      try {
        const commentCounts = {};
        for (const proposal of proposals) {
          const count = await dao.getCommentCount(proposal.id);
          commentCounts[proposal.id] = count.toNumber();
        }

        // Update comment counts in state
        const updatedComments = { ...proposalComments };
        Object.keys(commentCounts).forEach(proposalId => {
          if (!updatedComments[proposalId]) {
            updatedComments[proposalId] = [];
          }
          // Store count for display purposes
          updatedComments[proposalId]._count = commentCounts[proposalId];
        });

        setProposalComments(updatedComments);
      } catch (error) {
        console.warn('Failed to load comment counts:', error);
      }
    };

    loadAllCommentCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dao, proposals]); // proposalComments intentionally excluded to prevent infinite loop
  // Removed useEffect for loading comments from localStorage (for privacy option)

  // Note: Recipient balances are loaded in the main fetchData useEffect below
  // This avoids duplicate calls and uses the correct provider.getBalance method

  // Save visibility states to localStorage
  // New session loads hidden but persists user preferences
  useEffect(() => {
    localStorage.setItem('dao-showCommunityStats', JSON.stringify(showCommunityStats));
  }, [showCommunityStats]);

  useEffect(() => {
    localStorage.setItem('dao-showLeaderboard', JSON.stringify(showLeaderboard));
  }, [showLeaderboard]);

  useEffect(() => {
    localStorage.setItem('dao-showAnalytics', JSON.stringify(showAnalytics));
  }, [showAnalytics]);

  // Load blockchain voting data for all Hardhat addresses
  useEffect(() => {
    const loadBlockchainVotingData = async () => {
      if (!dao || !proposals || proposals.length === 0) return;

      const hardhatAddresses = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Deployer
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Investor 1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Investor 2
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Investor 3
      ];

      const votingData = {};

      for (const address of hardhatAddresses) {
        if (address !== userAddress) { // Skip current user
          votingData[address] = {
            totalVotes: 0,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            proposals: []
          };

          for (const proposal of proposals) {
            try {
              const hasVoted = await dao.hasVoted(address, proposal.id);
              if (hasVoted) {
                const voteChoice = await dao.getVoteChoice(address, proposal.id);

                votingData[address].totalVotes++;
                votingData[address].proposals.push(proposal.id.toString());

                if (voteChoice === 1) {
                  votingData[address].forVotes++;
                } else if (voteChoice === -1) {
                  votingData[address].againstVotes++;
                } else if (voteChoice === 2) {
                  votingData[address].abstainVotes++;
                }
              }
            } catch (error) {
              console.log(`Could not check vote for ${address} on proposal ${proposal.id}`);
            }
          }
        }
      }

      setBlockchainVotingData(votingData);
    };

    loadBlockchainVotingData();
  }, [dao, proposals, userAddress]);

  // Handle proposal creation success message from App.js
  useEffect(() => {
    if (proposalCreationSuccess) {
      setSuccessMessage(proposalCreationSuccess);
      setProposalCreationSuccess(''); // Clear the message after setting it
    }
  }, [proposalCreationSuccess, setProposalCreationSuccess]);

  // Enhanced synchronize horizontal scrolling between header and table
  useEffect(() => {
    const headerElement = document.querySelector('.external-table-header');
    const tableElement = document.querySelector('.table-container');

    if (headerElement && tableElement) {
      let isHeaderScrolling = false;
      let isTableScrolling = false;

      const syncScroll = (source, target, isSourceScrolling, setTargetScrolling) => {
        if (!isSourceScrolling) {
          setTargetScrolling(true);
          target.scrollLeft = source.scrollLeft;
          setTimeout(() => setTargetScrolling(false), 10);
        }
      };

      const handleHeaderScroll = () => {
        if (!isTableScrolling) {
          syncScroll(headerElement, tableElement, isHeaderScrolling, (val) => isHeaderScrolling = val);
        }
      };

      const handleTableScroll = () => {
        if (!isHeaderScrolling) {
          syncScroll(tableElement, headerElement, isTableScrolling, (val) => isTableScrolling = val);
        }
      };

      headerElement.addEventListener('scroll', handleHeaderScroll, { passive: true });
      tableElement.addEventListener('scroll', handleTableScroll, { passive: true });

      return () => {
        headerElement.removeEventListener('scroll', handleHeaderScroll);
        tableElement.removeEventListener('scroll', handleTableScroll);
      };
    }
  }, []);

  // Generate cool anonymous names for addresses
  const generateAnonymousName = (address) => {
    const adjectives = ['Mysterious', 'Silent', 'Wise', 'Bold', 'Swift', 'Noble', 'Fierce', 'Clever', 'Mighty', 'Ancient'];
    const animals = ['Whale', 'Eagle', 'Lion', 'Wolf', 'Dragon', 'Phoenix', 'Tiger', 'Shark', 'Bear', 'Falcon'];
    const colors = ['Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Violet', 'Obsidian', 'Pearl', 'Ruby', 'Sapphire'];

    // Use address to generate consistent but pseudo-random names
    const hash = address.slice(2); // Remove 0x
    const adjIndex = parseInt(hash.slice(0, 2), 16) % adjectives.length;
    const colorIndex = parseInt(hash.slice(2, 4), 16) % colors.length;
    const animalIndex = parseInt(hash.slice(4, 6), 16) % animals.length;

    return `${adjectives[adjIndex]} ${colors[colorIndex]} ${animals[animalIndex]}`;
  };

  // Calculate leaderboard data from real blockchain voting data
  const calculateLeaderboardData = () => {
    const voterStats = {};

    // Define REAL Hardhat addresses with their actual deployment token balances
    const realHardhatHolders = [
      { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', tokenBalance: 400000 }, // Hardhat Account #0 (Deployer)
      { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', tokenBalance: 200000 }, // Hardhat Account #1 (Investor 1)
      { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', tokenBalance: 200000 }, // Hardhat Account #2 (Investor 2)
      { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', tokenBalance: 200000 }, // Hardhat Account #3 (Investor 3)
      { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', tokenBalance: 0 },      // Hardhat Account #4 (Recipient)
    ];

    // Initialize all token holders with their real balances
    realHardhatHolders.forEach(holder => {
      if (holder.tokenBalance > 0) { // Only include token holders
        voterStats[holder.address] = {
          address: holder.address,
          totalVotes: 0,
          forVotes: 0,
          againstVotes: 0,
          abstainVotes: 0,
          tokenBalance: holder.tokenBalance,
          proposals: []
        };
      }
    });

    // Add current user votes from userVotes (current session)
    Object.entries(userVotes).forEach(([proposalId, voteChoice]) => {
      // Skip false values (no vote)
      if (voteChoice === false) return;

      const voter = userAddress;
      if (!voter) return;

      // Initialize user if not already in stats
      if (!voterStats[voter]) {
        let userBalance = 0;
        try {
          if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
            userBalance = Number(userTokenBalance);
          } else if (userTokenBalance && (userTokenBalance._isBigNumber || userTokenBalance.toString)) {
            userBalance = Number(ethers.utils.formatEther(userTokenBalance));
          }
        } catch (error) {
          console.error('Error processing user token balance:', error);
        }

        voterStats[voter] = {
          address: voter,
          totalVotes: 0,
          forVotes: 0,
          againstVotes: 0,
          abstainVotes: 0,
          tokenBalance: userBalance,
          proposals: []
        };
      }

      voterStats[voter].totalVotes++;
      voterStats[voter].proposals.push(proposalId);

      // Determine vote type from userVotes
      if (voteChoice === 1) voterStats[voter].forVotes++;
      else if (voteChoice === -1) voterStats[voter].againstVotes++;
      else if (voteChoice === 2) voterStats[voter].abstainVotes++;
    });

    // Add votes from userVoteHistory (deployed votes)
    Object.entries(userVoteHistory).forEach(([proposalId, voteData]) => {
      const voter = userAddress;
      if (!voter || !voteData) return;

      // Initialize user if not already in stats
      if (!voterStats[voter]) {
        let userBalance = 0;
        try {
          if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
            userBalance = Number(userTokenBalance);
          } else if (userTokenBalance && (userTokenBalance._isBigNumber || userTokenBalance.toString)) {
            userBalance = Number(ethers.utils.formatEther(userTokenBalance));
          }
        } catch (error) {
          console.error('Error processing user token balance:', error);
        }

        voterStats[voter] = {
          address: voter,
          totalVotes: 0,
          forVotes: 0,
          againstVotes: 0,
          abstainVotes: 0,
          tokenBalance: userBalance,
          proposals: []
        };
      }

      // Only count if not already counted in userVotes
      if (!userVotes[proposalId] || userVotes[proposalId] === false) {
        voterStats[voter].totalVotes++;
        voterStats[voter].proposals.push(proposalId);

        // Determine vote type from userVoteHistory
        if (voteData.type === 'For') voterStats[voter].forVotes++;
        else if (voteData.type === 'Against') voterStats[voter].againstVotes++;
        else if (voteData.type === 'Abstain') voterStats[voter].abstainVotes++;
      }
    });

    // Add blockchain voting data for Hardhat addresses if available
    Object.entries(blockchainVotingData).forEach(([address, addressData]) => {
      if (voterStats[address] && address !== userAddress) {
        voterStats[address].totalVotes = addressData.totalVotes || 0;
        voterStats[address].forVotes = addressData.forVotes || 0;
        voterStats[address].againstVotes = addressData.againstVotes || 0;
        voterStats[address].abstainVotes = addressData.abstainVotes || 0;
        voterStats[address].proposals = addressData.proposals || [];
      }
    });

    // Add current user to the stats if they have tokens
    if (userAddress && userTokenBalance) {
      let userBalance = 0;
      try {
        if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
          userBalance = Number(userTokenBalance);
        } else if (userTokenBalance._isBigNumber || userTokenBalance.toString) {
          userBalance = Number(ethers.utils.formatEther(userTokenBalance));
        }
      } catch (error) {
        console.error('Error processing user token balance:', error);
      }

      // Add current user with their ACTUAL token balance
      if (!voterStats[userAddress]) {
        voterStats[userAddress] = {
          address: userAddress,
          totalVotes: 0,
          forVotes: 0,
          againstVotes: 0,
          abstainVotes: 0,
          tokenBalance: userBalance,
          proposals: []
        };
      } else {
        // Update token balance for existing user
        voterStats[userAddress].tokenBalance = userBalance;
      }
    }

    // Note: Using only real blockchain voting data - no demo/simulated data for authentic experience

    // Convert to array and sort by token balance (for Voting Power Leaderboard)
    const result = Object.entries(voterStats)
      .map(([address, stats]) => ({
        address,
        ...stats,
        displayName: address === userAddress ? 'You' : generateAnonymousName(address)
      }))
      .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0)) // Sort by token balance
      .slice(0, 5); // Top 5

    return result;
  };

  // Vote confirmation function
  const confirmVote = (type, proposalName) => {
    const voteTypes = {
      1: 'FOR',
      '-1': 'AGAINST',
      2: 'ABSTAIN'
    };
    return window.confirm(
      `Are you sure you want to vote ${voteTypes[type]} on "${proposalName}"?\n\n` +
      `Your voting power: ${userTokenBalance} tokens`
    );
  };

  /**
   * Enhanced vote handler with confirmation
   *
   * This function demonstrates key blockchain development patterns:
   * 1. User confirmation before expensive transactions
   * 2. Proper error handling for different failure scenarios
   * 3. State management during async blockchain operations
   * 4. Integration between UI state and blockchain state
   *
   * @param {number} proposalId - The ID of the proposal to vote on
   * @param {number} voteType - Vote type: 1 = For, -1 = Against, 2 = Abstain
   * @param {string} proposalName - Name of the proposal for confirmation dialog
   */
  const handleVoteWithConfirmation = async (proposalId, voteType, proposalName) => {
    // Check if user has tokens before allowing vote
    if (!userAddress || !userTokenBalance) {
      setErrorMessage('❌ You must connect a wallet with DAO tokens to vote.');
      return;
    }

    let balance = 0;
    try {
      if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
        balance = Number(userTokenBalance);
      } else if (userTokenBalance._isBigNumber || userTokenBalance.toString) {
        balance = Number(ethers.utils.formatEther(userTokenBalance));
      }
    } catch (error) {
      console.error('Error processing token balance for voting:', error);
      setErrorMessage('❌ Error reading token balance. Please try again.');
      return;
    }

    if (balance === 0) {
      setErrorMessage('❌ You need DAO tokens to vote. Current balance: 0 tokens. Only token holders can participate in governance.');
      return;
    }

    if (!confirmVote(voteType, proposalName)) {
      return; // User cancelled
    }

    // Clear any previous messages
    setSuccessMessage('');
    setErrorMessage('');

    // Show loading state
    setVotingProposalId(proposalId);

    try {
      const signer = await provider.getSigner();

      let transaction;
      if (voteType === 2) {
        // Abstain vote
        transaction = await dao.connect(signer)["vote(uint256,int8)"](proposalId, 2);
      } else {
        // For/Against vote
        transaction = await dao.connect(signer)["vote(uint256,bool)"](proposalId, voteType === 1);
      }

      console.log(`🗳️ Vote submitted for Proposal ${proposalId}:`, { voteType: voteType === 1 ? 'For' : voteType === -1 ? 'Against' : 'Abstain', txHash: transaction.hash });
      await transaction.wait();
      console.log('✅ Vote confirmed on blockchain');

      // Update vote history
      const voteTypes = { 1: 'For', '-1': 'Against', 2: 'Abstain' };
      const newVoteHistory = {
        ...userVoteHistory,
        [proposalId.toString()]: {
          type: voteTypes[voteType],
          timestamp: new Date().toISOString(),
          transactionHash: transaction.hash
        }
      };

      setUserVoteHistory(newVoteHistory);

      // Save to localStorage for persistence
      try {
        localStorage.setItem('daoVoteHistory', JSON.stringify(newVoteHistory));
      } catch (error) {
        console.error('Error saving vote history to localStorage:', error);
      }

      // Update local state with actual vote type
      const newVotes = {...userVotes};
      newVotes[proposalId.toString()] = voteType;
      setUserVotes(newVotes);

      // Show success message immediately - blockchain data will reload when user dismisses modal
      setSuccessMessage(`✓ Vote submitted successfully! 🗳️ (${voteTypes[voteType]})`);

    } catch (error) {
      console.error('Error voting:', error);

      let errorMsg = 'Transaction failed. Please try again.';
      if (error.reason && error.reason.includes('must be token holder')) {
        errorMsg = 'You must be a token holder to vote on proposals.';
      } else if (error.reason && error.reason.includes('already voted')) {
        errorMsg = 'You have already voted on this proposal.';
      } else if (error.message && error.message.includes('user rejected')) {
        errorMsg = 'Transaction was rejected by the user.';
      }

      setErrorMessage(errorMsg);
      setTimeout(() => setErrorMessage(''), 5000);

    } finally {
      setVotingProposalId(null);
    }
  };

  /* MetaMask Account Change Detection
      A listener to automatically refresh the UI when the user switches accounts
        Improves UX by eliminating the need for manual page refresh*/
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log('MetaMask account changed:', accounts[0]);
        // Refresh data when account changes
        setIsLoading(true);
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };// Cleanup listener when component unmounts
    }
  }, [setIsLoading]);

  /* Blockchain Vote Verification
      This hook fetches both recipient balances and verifies votes directly from the blockchain
        using dao.hasVoted() ensures UI accurately reflects on-chain voting state
        being more reliable than localStorage or local state alone*/
  useEffect(() => {
    const fetchData = async () => {
      if (provider && dao && proposals) {
        try {
          // Get current user address
          const signer = await provider.getSigner();
          const userAddress = await signer.getAddress();

          // Initialize balances object, votes object, and abstain votes
          const balances = {};
          const votesStatus = {};
          const abstainVotes = {};

          // Get balances for all recipients, check user votes, and load abstain votes
          for (const proposal of proposals) {
            // Fetch recipient balance
            const balance = await provider.getBalance(proposal.recipient);
            balances[proposal.recipient] = ethers.utils.formatEther(balance);

            // Fetch abstain votes for this proposal
            try {
              const abstainVoteCount = await dao.proposalAbstainVotes(proposal.id);
              abstainVotes[proposal.id.toString()] = Number(ethers.utils.formatEther(abstainVoteCount));
            } catch (error) {
              console.error(`Error fetching abstain votes for proposal ${proposal.id}:`, error);
              abstainVotes[proposal.id.toString()] = 0;
            }

            // Check if user has voted on this proposal and get vote type
            try {
              const hasVoted = await dao.hasVoted(userAddress, proposal.id);
              if (hasVoted) {
                // Try to get the actual vote choice from blockchain
                try {
                  const voteChoice = await dao.getVoteChoice(userAddress, proposal.id);
                  // voteChoice is int8: 1=For, -1=Against, 0=Abstain
                  votesStatus[proposal.id.toString()] = voteChoice;
                } catch (voteError) {
                  console.error(`Error getting vote choice for proposal ${proposal.id}:`, voteError);
                  // Fallback: just mark as voted but unknown type
                  votesStatus[proposal.id.toString()] = hasVoted;
                }
              } else {
                votesStatus[proposal.id.toString()] = false;
              }

            } catch (error) {
              console.error(`Error checking vote for proposal ${proposal.id}:`, error);
              votesStatus[proposal.id.toString()] = false;
            }
          }

          // Update recipient balances
          setRecipientBalances(balances);

          // Abstain votes now loaded directly from proposal.abstainVotes
          // Update user votes
          setUserVotes(votesStatus);

        } catch (error) {
          console.error("Error fetching data:", error);
        }
      }
    };
    fetchData();
  }, [provider, dao, proposals]);

  // ***** Vote handling is now done directly in the onClick handler of each button

  /**
   * Handle finalizing a proposal that has reached quorum
   *
   * @param {BigNumber} id - The ID of the proposal to finalize
   */
  const finalizeHandler = async (id) => {
    console.log('Finalizing proposal...\n' +
                 'Proposal ID: ' + id.toString() + '\n' +
                 '----------------------------------------');

    // Update UI to show loading state for this specific proposal
    setFinalizingProposalId(id);

    try {
      const signer = await provider.getSigner();
      const transaction = await dao.connect(signer).finalizeProposal(id);// Call the finalizeProposal function on the DAO contract
      // This will mark the proposal as finalized and transfer funds to the recipient
      await transaction.wait();

      // Show success message immediately - blockchain data will reload when user dismisses modal
      setSuccessMessage(`✓ Proposal ${id} finalized successfully! 🎉 \n\n\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Funds have been transferred to the recipient. 💸`);
    } catch (error) {
      console.error("Error finalizing:", error);
      if (error.reason) {
        window.alert(`Transaction failed: ${error.reason}`);
      } else if (error.message) {
        window.alert(`Error: ${error.message}`);
      } else {
        window.alert('User rejected or transaction reverted');
      }
    }
    setFinalizingProposalId(null);
  }

  /**
   * Helper function to format Ethereum addresses for display
   * Shows first 6 and last 4 characters with ellipsis in between
   *
   * @param {string} address - The full Ethereum address
   * @returns {string} - Formatted address (e.g., "0x1234...5678")
   */
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  /**
   * Load on-chain comments for a specific proposal
   */
  const loadOnChainComments = async (proposalId) => {
    if (!dao) return;

    try {
      setLoadingComments(true);
      const commentCount = await dao.getCommentCount(proposalId);
      const comments = [];

      for (let i = 0; i < commentCount; i++) {
        const comment = await dao.getComment(proposalId, i);
        comments.push({
          author: comment.author,
          text: comment.text,
          timestamp: comment.timestamp.toNumber() * 1000, // Convert to milliseconds
          onChain: true
        });
      }

      setProposalComments(prev => ({
        ...prev,
        [proposalId]: comments
      }));
    } catch (error) {
      console.error('Error loading on-chain comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  /**
   * Add a comment on-chain
   */
  const addOnChainComment = async (proposalId, text) => {
    if (!dao || !provider) return;

    try {
      const signer = provider.getSigner();
      const transaction = await dao.connect(signer).addComment(proposalId, text);
      await transaction.wait();

      // Force a delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reload comments after successful addition
      await loadOnChainComments(proposalId);

      // Also trigger a general blockchain data reload to update comment counts
      if (loadBlockchainData) {
        await loadBlockchainData();
      }

      return true;
    } catch (error) {
      console.error('Error adding on-chain comment:', error);
      throw error;
    }
  };

  /**
   * Helper function to determine proposal status with color-coded badge
   *
   * @param {Object} proposal - The proposal object
   * @returns {JSX.Element} - Badge component with appropriate color and text
   */
  const getStatusBadge = (proposal) => {
    if (proposal.cancelled) {
      return <Badge bg="danger" style={{ fontSize: '0.9rem', padding: '0.5rem' }}><small>✗</small> &nbsp;Cancelled&nbsp; <small>✗</small></Badge>;
    } else if (proposal.finalized) {
      return <Badge bg="success" style={{ fontSize: '0.9rem', padding: '0.5rem' }}><small>✓</small> &nbsp;Approved&nbsp; <small>✓</small></Badge>;
    } else if (proposal.votes >= quorum) {
      return <Badge bg="warning" style={{ fontSize: '0.9rem', padding: '0.5rem' }}><big>🤩</big> Ready to Finalize <big>🎯👉🏾</big></Badge>;
    } else if (proposal.votes <= -quorum) {
      return <Badge bg="danger" style={{ fontSize: '0.9rem', padding: '0.5rem' }}><big>😞</big> Ready to Cancel <big>🎯👉</big></Badge>;
    } else {
      return <Badge bg="info" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>In Progress <big>😁</big></Badge>;
    }
  };

  /**
   * Handle cancelling a proposal when against votes reach quorum
   *
   * @param {BigNumber} id - The ID of the proposal to cancel
   */
  // Handle success modal dismissal with blockchain data refresh
  const handleSuccessModalDismiss = async () => {
    setSuccessMessage('');
    // Reload blockchain data after user dismisses the modal
    console.log('Success modal dismissed, reloading blockchain data...');
    await loadBlockchainData();
  };

  // Handle error modal dismissal (no blockchain refresh needed)
  const handleErrorModalDismiss = () => {
    setErrorMessage('');
  };

  const cancelHandler = async (id) => {
    console.log('Cancelling proposal...\\n' +
                 'Proposal ID: ' + id.toString() + '\\n' +
                 '----------------------------------------');

    // Update UI to show loading state for this specific proposal
    setCancellingProposalId(id);

    try {
      const signer = await provider.getSigner();
      const transaction = await dao.connect(signer).cancelProposal(id);
      await transaction.wait();

      // Show success message immediately - blockchain data will reload when user dismisses modal
      setSuccessMessage(`✓ Proposal ${id} successfully cancelled. 🚫 \n\n\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0The proposal has been rejected by the community. 👎`);
    } catch (error) {
      console.error("Error cancelling:", error);
      if (error.reason) {
        window.alert(`Transaction failed: ${error.reason}`);
      } else if (error.message) {
        window.alert(`Error: ${error.message}`);
      } else {
        window.alert('User rejected or transaction reverted');
      }
    }
    setCancellingProposalId(null);
  };

  return (
    <>


      {/* Success/Error Modals */}
      <Modal show={!!successMessage} onHide={handleSuccessModalDismiss} centered>
        <Modal.Header closeButton style={{ backgroundColor: '#d4edda', borderColor: '#c3e6cb' }}>
          <Modal.Title style={{ color: '#155724' }}>
            <strong>✅ Success!</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#d4edda', color: '#155724' }}>
          <div style={{ whiteSpace: 'pre-line' }}>
            {successMessage}
          </div>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#d4edda', borderColor: '#c3e6cb' }}>
          <Button variant="success" onClick={handleSuccessModalDismiss}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!errorMessage} onHide={handleErrorModalDismiss} centered>
        <Modal.Header closeButton style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }}>
          <Modal.Title style={{ color: '#721c24' }}>
            <strong>❌ Error!</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#f8d7da', color: '#721c24' }}>
          {errorMessage}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }}>
          <Button variant="danger" onClick={handleErrorModalDismiss}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Community Participation Progress - Show first, above engagement stats */}
      {proposals.filter(p => !p.finalized && !p.cancelled).length > 0 && (
        <div className="mb-4">
          <ParticipationProgress
            proposals={proposals.filter(p => !p.finalized && !p.cancelled)}
            totalSupply={ethers.utils.parseEther('1000000')} // 1M total supply
          />
        </div>
      )}

      {/* Community Engagement Stats */}
      {showCommunityStats && (
        <div className="mb-3 p-3" style={{
          background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.1)'
        }}>
          <h5 className="mb-3">🏆 Community Engagement</h5>
          <div className="row">
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-primary">📋 Total Proposals</h6>
                <div className="mb-2">
                  <strong>{proposals.length}</strong>
                </div>
                <small className="text-muted">
                  {(() => {
                    const finalized = proposals.filter(p => p.finalized).length;
                    const cancelled = proposals.filter(p => p.cancelled).length;
                    const inProgress = proposals.length - finalized - cancelled;
                    return `${finalized} finalized • ${cancelled} cancelled • ${inProgress} in-progress`;
                  })()}
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-success">👥 Total Participants</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      const leaderboardData = calculateLeaderboardData();
                      // Count all participants including current user and test data
                      let totalParticipants = 0;

                      // Count leaderboard participants
                      totalParticipants += leaderboardData.filter(voter => voter.totalVotes > 0).length;

                      // Add current user if they have votes but aren't in leaderboard
                      if (userAddress && (Object.keys(userVotes).filter(id => userVotes[id] !== false).length > 0 || Object.keys(userVoteHistory).length > 0)) {
                        const userInLeaderboard = leaderboardData.some(voter => voter.address === userAddress);
                        if (!userInLeaderboard) {
                          totalParticipants += 1;
                        }
                      }

                      // Return actual participant count from real blockchain data
                      return totalParticipants;
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  Active voting members
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-success">📊 Community Activity</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      const leaderboardData = calculateLeaderboardData();
                      let totalVotes = leaderboardData.reduce((sum, voter) => sum + voter.totalVotes, 0);

                      // Add current user votes if not in leaderboard
                      if (userAddress) {
                        const userInLeaderboard = leaderboardData.some(voter => voter.address === userAddress);
                        if (!userInLeaderboard) {
                          const userCurrentVotes = Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                          const userHistoryVotes = Object.keys(userVoteHistory).length;
                          totalVotes += userCurrentVotes + userHistoryVotes;
                        }
                      }

                      // Use actual vote count from real blockchain data

                      const avgVotesPerProposal = proposals.length > 0 ? Math.round(totalVotes / proposals.length) : 0;
                      return `${avgVotesPerProposal} votes/proposal`;
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  Average participation per proposal
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-info">🗳️ Total Votes Cast</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      const leaderboardData = calculateLeaderboardData();
                      let totalVotes = leaderboardData.reduce((sum, voter) => sum + voter.totalVotes, 0);

                      // Add current user votes if not in leaderboard
                      if (userAddress) {
                        const userInLeaderboard = leaderboardData.some(voter => voter.address === userAddress);
                        if (!userInLeaderboard) {
                          const userCurrentVotes = Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                          const userHistoryVotes = Object.keys(userVoteHistory).length;
                          totalVotes += userCurrentVotes + userHistoryVotes;
                        }
                      }

                      // Use actual vote count from real blockchain data

                      return totalVotes;
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  Across all proposals
                </small>
              </div>
            </div>

          </div>

          {/* Achievement Levels - Enticing Display */}

          {/* Advanced Community Features */}
          <div className="mt-4">
            <div className="row justify-content-center">
              <div className="col-md-3">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="w-100 mb-2"
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                >
                  🏅 Leaderboard
                </Button>
              </div>

              <div className="col-md-3">
                <Button
                  variant="outline-success"
                  size="sm"
                  className="w-100 mb-2"
                  onClick={() => setShowAnalytics(!showAnalytics)}
                >
                  📊 Current User's Analytics
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Section */}
      {showLeaderboard && (
        <div className="mb-3 p-3" style={{
          background: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.1)'
        }}>
          <h5 className="mb-3">🏅 Community Leaderboard</h5>
          <div className="row">
            <div className="col-md-6">
              <h6>🗳️ Most Active Voters</h6>
              <div className="list-group list-group-flush">
                {calculateLeaderboardData().length > 0 ? (
                  calculateLeaderboardData().map((voter, index) => {
                    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];

                    // Color scheme: Green for highest votes, fading to yellow, gray for 0 votes
                    const getBadgeColor = (votes, maxVotes) => {
                      if (votes === 0) return 'secondary'; // Gray for 0 votes
                      const ratio = votes / maxVotes;
                      if (ratio >= 0.8) return 'success'; // Green for highest
                      if (ratio >= 0.6) return 'primary'; // Blue for high
                      if (ratio >= 0.4) return 'info'; // Light blue for medium
                      if (ratio >= 0.2) return 'warning'; // Yellow for low
                      return 'light'; // Light gray for very low
                    };

                    const maxVotes = Math.max(...calculateLeaderboardData().map(v => v.totalVotes));
                    const badgeColor = getBadgeColor(voter.totalVotes, maxVotes);

                    return (
                      <div key={voter.address} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{medals[index]} {voter.displayName}</span>
                        <span className={`badge bg-${badgeColor} rounded-pill`} style={{
                          color: badgeColor === 'light' ? '#000' : '#fff',
                          fontWeight: 'bold'
                        }}>
                          {voter.totalVotes} votes
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="list-group-item text-center text-muted">
                    <small>No voting data available yet</small>
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <h6>💪 Voting Power Leaderboard</h6>
              <div className="list-group list-group-flush">
                <div className="list-group-item d-flex justify-content-between align-items-center">
                  <span>🥇 You</span>
                  <span className="badge bg-success rounded-pill">
                    {(() => {
                      try {
                        if (!userAddress || !userTokenBalance) return 'Connect Wallet';

                        let balance = 0;
                        if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
                          balance = Number(userTokenBalance);
                        } else {
                          balance = Number(ethers.utils.formatEther(userTokenBalance));
                        }

                        return balance > 0 ? `${balance.toLocaleString()} tokens` : 'No tokens';
                      } catch (error) {
                        return 'Connect Wallet';
                      }
                    })()}
                  </span>
                </div>

                {/* Show other real investors from leaderboard data */}
                {(() => {
                  const leaderboardData = calculateLeaderboardData();
                  const otherInvestors = leaderboardData
                    .filter(investor => investor.address !== userAddress)
                    .sort((a, b) => (b.tokenBalance || 0) - (a.tokenBalance || 0)) // Sort by token balance
                    .slice(0, 3); // Show top 3 other investors

                  return otherInvestors.map((investor, index) => {
                    const tokenBalance = investor.tokenBalance || 0;

                    // Color scheme: Green for highest tokens, fading to yellow, gray for 0 tokens
                    const getBadgeColor = (tokens, maxTokens) => {
                      if (tokens === 0) return 'secondary'; // Gray for 0 tokens
                      const ratio = tokens / maxTokens;
                      if (ratio >= 0.8) return 'success'; // Green for highest
                      if (ratio >= 0.6) return 'primary'; // Blue for high
                      if (ratio >= 0.4) return 'info'; // Light blue for medium
                      if (ratio >= 0.2) return 'warning'; // Yellow for low
                      return 'light'; // Light gray for very low
                    };

                    const maxTokens = Math.max(...otherInvestors.map(inv => inv.tokenBalance || 0));
                    const badgeColor = getBadgeColor(tokenBalance, maxTokens);

                    return (
                      <div key={investor.address} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>
                          {index === 0 ? '🥈' : index === 1 ? '🥉' : '🏅'} {generateAnonymousName(investor.address)}
                        </span>
                        <span className={`badge bg-${badgeColor} rounded-pill`} style={{
                          color: badgeColor === 'light' ? '#000' : '#fff',
                          fontWeight: 'bold'
                        }}>
                          {tokenBalance.toLocaleString()} tokens
                        </span>
                      </div>
                    );
                  });
                })()}

                {userAddress && userTokenBalance && (
                  <div className="list-group-item">
                    <small className="text-muted">
                      Rankings based on voting activity. Your voting power equals your token balance.
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="mb-3 p-3" style={{
          background: 'linear-gradient(135deg, #f3e5f5 0%, #e3f2fd 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.1)'
        }}>
          <h5 className="mb-3">🎯 Your Personal Voting Analytics</h5>
          <div className="row">
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-primary">🗳️ Your Votes</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      // Only count if user has tokens and is connected
                      if (!userAddress || !userTokenBalance) return 0;

                      let balance = 0;
                      try {
                        // Handle both BigNumber and string/number formats
                        if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
                          balance = Number(userTokenBalance);
                        } else {
                          balance = Number(ethers.utils.formatEther(userTokenBalance));
                        }
                      } catch (error) {
                        console.error('Error processing token balance:', error);
                        return 0;
                      }

                      if (balance === 0) return 0;

                      // Count unique proposals voted on from current session only
                      const votedProposals = new Set(
                        Object.keys(userVotes).filter(id => userVotes[id] !== false)
                      );
                      return votedProposals.size;
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  Total proposals voted on
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-success">💪 Voting Power</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      try {
                        // Use actual token balance from blockchain
                        if (!userAddress) return 'Connect Wallet';
                        if (!userTokenBalance) return '0';

                        let balance = 0;
                        // Handle both BigNumber and string/number formats
                        if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
                          balance = Number(userTokenBalance);
                        } else if (userTokenBalance._isBigNumber || userTokenBalance.toString) {
                          balance = Number(ethers.utils.formatEther(userTokenBalance));
                        }

                        return balance > 0 ? balance.toLocaleString() : '0';
                      } catch (error) {
                        console.error('Error formatting token balance:', error);
                        return '0';
                      }
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  DAO tokens
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-info">📊 Participation</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      // Only calculate if user has tokens
                      if (!userAddress || !userTokenBalance) return '0';

                      let balance = 0;
                      try {
                        // Handle both BigNumber and string/number formats
                        if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
                          balance = Number(userTokenBalance);
                        } else {
                          balance = Number(ethers.utils.formatEther(userTokenBalance));
                        }
                      } catch (error) {
                        console.error('Error processing token balance for participation:', error);
                        return '0';
                      }

                      if (balance === 0) return '0';

                      const votedProposals = new Set(
                        Object.keys(userVotes).filter(id => userVotes[id] !== false)
                      );
                      const percentage = proposals.length > 0 ? Math.round((votedProposals.size / proposals.length) * 100) : 0;

                      return percentage;
                    })()}%
                  </strong>
                </div>
                <small className="text-muted">
                  Of all proposals
                </small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center">
                <h6 className="text-warning">⏱️ Response Time</h6>
                <div className="mb-2">
                  <strong>
                    {(() => {
                      const votedCount = Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                      if (votedCount === 0) return "No data";
                      if (votedCount === 1) return "First vote!";
                      if (votedCount >= 5) return "< 1 day";
                      if (votedCount >= 3) return "1-2 days";
                      return "2-3 days";
                    })()}
                  </strong>
                </div>
                <small className="text-muted">
                  Average response time
                </small>
              </div>
            </div>
          </div>

          {/* Achievement Levels */}
          <div className="mt-3 p-2" style={{
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <h6 className="text-center mb-2">🎯 Achievement Levels</h6>
            <p className="text-center text-muted mb-3" style={{ fontSize: '0.8rem' }}>
              <em>Your personal voting milestones</em>
            </p>
            <div className="row text-center">
              <div className="col-3">
                <div className={`p-2 rounded ${(() => {
                  const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                  return totalVotes >= 0 ? 'bg-light' : 'bg-white';
                })()}`}>
                  <div style={{ opacity: (() => {
                    const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                    return totalVotes >= 0 ? 1 : 0.5;
                  })() }}>
                    🆕 <strong>New</strong>
                    <br />
                    <small>0 votes</small>
                  </div>
                </div>
              </div>
              <div className="col-3">
                <div className={`p-2 rounded ${(() => {
                  const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                  return totalVotes >= 1 ? 'bg-light' : 'bg-white';
                })()}`}>
                  <div style={{ opacity: (() => {
                    const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                    return totalVotes >= 1 ? 1 : 0.5;
                  })() }}>
                    🥈 <strong>Participant</strong>
                    <br />
                    <small>1+ votes</small>
                  </div>
                </div>
              </div>
              <div className="col-3">
                <div className={`p-2 rounded ${(() => {
                  const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                  return totalVotes >= 2 ? 'bg-light' : 'bg-white';
                })()}`}>
                  <div style={{ opacity: (() => {
                    const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                    return totalVotes >= 2 ? 1 : 0.5;
                  })() }}>
                    🥉 <strong>Engaged</strong>
                    <br />
                    <small>2+ votes</small>
                  </div>
                </div>
              </div>
              <div className="col-3">
                <div className={`p-2 rounded ${(() => {
                  const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                  return totalVotes >= 5 ? 'bg-light' : 'bg-white';
                })()}`}>
                  <div style={{ opacity: (() => {
                    const totalVotes = Object.keys(userVoteHistory).length + Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                    return totalVotes >= 5 ? 1 : 0.5;
                  })() }}>
                    🏆 <strong>Active</strong>
                    <br />
                    <small>5+ votes</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center mt-3">
              <div className="mb-2">
                <h6 className="text-warning">🏅 Current Status</h6>
                <strong>
                  {(() => {
                    // Only show status if user has tokens
                    if (!userAddress || !userTokenBalance) return '🆕 New';

                    let balance = 0;
                    try {
                      if (typeof userTokenBalance === 'string' || typeof userTokenBalance === 'number') {
                        balance = Number(userTokenBalance);
                      } else if (userTokenBalance._isBigNumber || userTokenBalance.toString) {
                        balance = Number(ethers.utils.formatEther(userTokenBalance));
                      }
                    } catch (error) {
                      console.error('Error processing token balance for status:', error);
                      return '🆕 New';
                    }

                    // If no tokens, always show New regardless of vote history
                    if (balance === 0) return '🆕 New';

                    // Count both deployed votes and current session votes
                    const deployedVotes = Object.keys(userVoteHistory).length;
                    const currentVotes = Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                    const totalVotes = deployedVotes + currentVotes;

                    return totalVotes >= 5 ? '🏆 Active' :
                           totalVotes >= 2 ? '🥉 Engaged' :
                           totalVotes >= 1 ? '🥈 Participant' : '🆕 New';
                  })()}
                </strong>
                <br />
                <small className="text-muted">Community member</small>
              </div>
              <small className="text-muted">
                {(() => {
                  // Count both deployed votes and current session votes
                  const deployedVotes = Object.keys(userVoteHistory).length;
                  const currentVotes = Object.keys(userVotes).filter(id => userVotes[id] !== false).length;
                  const totalVotes = deployedVotes + currentVotes;

                  if (totalVotes === 0) {
                    return <>Vote on 1 proposal to become a 🥈 Participant! 🚀</>;
                  } else if (totalVotes === 1) {
                    return <>Vote on 1 more proposal to become 🥉 Engaged! 📈</>;
                  } else if (totalVotes >= 2 && totalVotes < 5) {
                    return <>Vote on {5 - totalVotes} more proposal{5 - totalVotes !== 1 ? 's' : ''} to become 🏆 Active! 💪</>;
                  } else {
                    return <>🎉 Congratulations! You've reached the highest level! 🎉</>;
                  }
                })()}
              </small>
            </div>
          </div>
        </div>
      )}

      {/* Component header with title, quorum information, and debug buttons */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1">Proposals | Governance</h4>
          <p className="text-muted mb-0" style={{ paddingLeft: '20px' }}>
            <small>Quorum required: {'> '}</small>
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{ethers.utils.formatEther(quorum)} ETH (exact value)</Tooltip>}
            >
              <span><small>
                {(() => {
                  const value = Number(ethers.utils.formatEther(quorum));

                  // Option 3: K/M/B/T notation
                  if (value >= 1e12) return (value / 1e12).toFixed(1) + 'T ETH';
                  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B ETH';
                  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M ETH';
                  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K ETH';
                  return value.toFixed(1) + ' ETH';
                })()}</small>
              </span>
            </OverlayTrigger>
          </p>
        </div>

        {/* Debugging Tools
              buttons to help developers troubleshoot blockchain interaction issues
              providing console logging and state manipulation for testing
        */}
        <div>
          <Button
            variant="outline-secondary"
            size="sm"
            className="me-2"
            onClick={() => {
              console.log('Current vote state:', userVotes);
              alert('Check console for vote state');
            }}
          >
            Debug: Check Vote State
          </Button>

          <Button
            variant="outline-danger"
            size="sm"
            className="me-2"
            onClick={() => {
              setUserVotes({});
              console.log('Cleared local vote state (blockchain votes remain)');
              alert('Local vote state cleared. Note: Your votes are still recorded on the blockchain.');
            }}
          >
            Debug: Clear Vote State
          </Button>

          <Button
            variant="outline-info"
            size="sm"
            className="me-2"
            onClick={async () => {
              console.log('Manually reloading blockchain data...');

              try {
                // Get current user address
                const signer = await provider.getSigner();
                const userAddress = await signer.getAddress();
                console.log(`Current user: ${userAddress}`);

                // Check votes for all proposals and get actual vote types
                const votesStatus = {};
                for (const proposal of proposals) {
                  try {
                    const hasVoted = await dao.hasVoted(userAddress, proposal.id);
                    if (hasVoted) {
                      // Try to get the actual vote choice from blockchain
                      try {
                        const voteChoice = await dao.getVoteChoice(userAddress, proposal.id);
                        // voteChoice is int8: 1=For, -1=Against, 0=Abstain
                        votesStatus[proposal.id.toString()] = voteChoice;

                      } catch (voteError) {
                        console.error(`Error getting vote choice for proposal ${proposal.id}:`, voteError);
                        // Fallback: just mark as voted
                        votesStatus[proposal.id.toString()] = hasVoted;
                      }
                    } else {
                      votesStatus[proposal.id.toString()] = false;
                    }

                  } catch (error) {
                    console.error(`Error checking vote for proposal ${proposal.id}:`, error);
                  }
                }

                // Update user votes
                setUserVotes(votesStatus);
                console.log('Blockchain data reload complete');
                alert('Blockchain data reloaded. Check console for details.');
              } catch (error) {
                console.error('Error reloading blockchain data:', error);
                alert('Error reloading blockchain data. Check console for details.');
              }
            }}
          >
            Debug: Reload Blockchain Data
          </Button>

          <Button
            variant="outline-success"
            size="sm"
            onClick={() => setShowCommunityStats(!showCommunityStats)}
          >
            {showCommunityStats ? '📊 Hide' : '🏆 Community'} Stats
          </Button>
        </div>
      </div>

      {/* External header with precise table column matching */}
      <div className="external-table-header" style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: 'white',
        borderRadius: '8px 8px 0 0',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
        marginBottom: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        border: '1px solid #dee2e6',
        borderBottom: 'none'
      }}>
        {/* Use table structure with CSS classes for perfect alignment */}
        <table style={{
          width: '100%',
          minWidth: '1247px', // Updated for new Actions column width
          tableLayout: 'fixed'
        }}>
          <thead>
            <tr>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>#</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>Proposal Name</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>& Amount</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>Recipient Address</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>& Balance</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>Votes (% of Quorum)</th>
              <th style={{ border: 'none', background: 'transparent', color: 'white', padding: '1rem 0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Table body without header */}
      <div className="table-container" style={{
        height: '70vh',
        overflowY: 'auto',
        overflowX: 'auto',
        border: '1px solid #dee2e6',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px'
      }}>
        <Table striped bordered hover style={{
          marginBottom: 0,
          minWidth: '1281px', // Updated to match CSS
          tableLayout: 'fixed',
          width: '1281px'
        }}>
          {/* Force exact column widths */}
          <colgroup>
            <col style={{ width: '50px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '88px' }} />
            <col style={{ width: '144px' }} />
            <col style={{ width: '111px' }} />
            <col style={{ width: '222px' }} />
            <col style={{ width: '222px' }} />
            <col style={{ width: '244px' }} />
          </colgroup>
          {/* Combined informational header that maintains column alignment */}
          <thead>
            <tr>
              <th
                colSpan="8"
                style={{
                  padding: '6px 12px',
                  margin: 0,
                  border: '1px solid #dee2e6',
                  backgroundColor: '#f8f9fa',
                  textAlign: 'center',
                  fontSize: '0.77rem',
                  color: '#6c757d',
                  fontStyle: 'italic',
                  whiteSpace: 'nowrap',
                  height: '32px',
                  lineHeight: '1px'
                }}
              >
                <em>← Scroll table horizontally to see all columns → | Scroll vertically to view all proposals</em>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Map through all proposals in reverse order (most recent first) */}
            {/*Created a Copy of the Proposals Array using the spread operator [...proposals] to create a new arra to avoidmutating the original array which could cause side effects*/}
            {/* ↓ */}
            {[...proposals].reverse().map((proposal, index) => (
            <tr key={index} className="align-middle">
              {/* ↑ React requires a unique key for each element/child in a list */}

              {/* Proposal ID */}
              <td className="text-center">{proposal.id.toString()}</td>

              {/* Proposal name with description underneath */}
              <td>
                <div>
                  <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip>
                      <div>
                        <strong>ID:</strong> {proposal.id.toString()}<br/>
                        <strong>Description:</strong> {proposal.description || "No description provided"}
                      </div>
                    </Tooltip>}
                  >
                    <span>
                      {(() => {
                        const parts = proposal.name.split(' - ');
                        return parts[0]; // Show only the "Test Proposal #" part
                      })()} 
                    </span>
                  </OverlayTrigger>
                  {(() => {
                    const parts = proposal.name.split(' - ');
                    if (parts.length > 1) {
                      return (
                        <div>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>{parts[1]}</small>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Comments button under proposal name */}
                  <div className="mt-1">
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>View and add comments (count shows on-chain comments only)</Tooltip>}
                    >
                      <Button
                        variant="outline-info"
                        size="sm"
                        onClick={() => {
                          setSelectedProposalForComments(proposal);
                          setShowCommentsModal(true);
                          // Load on-chain comments when modal opens
                          if (useOnChainComments) {
                            loadOnChainComments(proposal.id);
                          }
                        }}
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      >
                        💬 Comments ({
                          (proposalComments[proposal.id] && proposalComments[proposal.id]._count !== undefined)
                            ? proposalComments[proposal.id]._count
                            : (proposalComments[proposal.id] || []).length
                        })
                      </Button>
                    </OverlayTrigger>
                  </div>
                </div>
              </td>

            {/* Amount in ETH (converted from wei) */}
            <td className="text-center">{ethers.utils.formatUnits(proposal.amount, "ether")} ETH</td>

              {/* Recipient address (shortened) with tooltip showing full address */}
              <td className="text-center">
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>{proposal.recipient}</Tooltip>}
                  >
                  <span>{formatAddress(proposal.recipient)}</span>
                </OverlayTrigger>
              </td>

              {/* Recipient balance in ETH */}
              <td className="text-center">
                {recipientBalances[proposal.recipient] ?
                  `${parseFloat(recipientBalances[proposal.recipient]).toFixed(4)} ETH` :
                  <small className="text-muted">Loading...</small>
                }
              </td>

              {/* //{proposal.finalized ? 'Approved' : 'In Progress'} */}
              {/* ? = Ternary operator ; return string 'Approved' if proposal.finalized is true, else return 'In Progress' */}
                {/* Now using JSX 'getStatusBadge'function to determine and display status with color-coded badge */}
                {/* ↓ */}
              {/* Status badge (color-coded) with participation */}
              <td className="text-center">
                <div>{getStatusBadge(proposal)}</div>
                <div className="mt-2">
                  {(() => {
                    // For simplified contract, estimate participation from absolute vote values
                    const netVotes = Number(ethers.utils.formatEther(proposal.votes || 0));
                    const totalParticipation = Math.abs(netVotes); // Estimate from absolute votes
                    const totalSupply = 1000000; // 1M total supply
                    const participationRate = totalSupply > 0 ? (totalParticipation / totalSupply) * 100 : 0;

                    // Calculate vote distribution for simplified contract
                    // Note: Detailed vote breakdown not available in simplified contract
                    const quorumAmount = Number(ethers.utils.formatEther(quorum));

                    // Simplified display - show net votes as percentage of quorum
                    const netVotePercentage = quorumAmount > 0 ? Math.abs(netVotes / quorumAmount) * 100 : 0;
                    const isPositive = netVotes >= 0;

                    // For simplified contract, we can't show detailed breakdown
                    const positivePercentage = isPositive ? Math.min(100, netVotePercentage) : 0;
                    const negativePercentage = !isPositive ? Math.min(100, netVotePercentage) : 0;
                    const abstainPercentage = 0; // Not tracked in simplified contract

                    // Color based on participation rate
                    const textColor = participationRate >= 100 ? 'text-success' :
                      participationRate >= 50 ? 'text-info' : 'text-muted';

                    return (
                      <>
                        <small className={textColor}>
                          {participationRate.toFixed(1)}% participated
                        </small>
                        <div className="mt-1" style={{ width: '100px', margin: '0 auto' }}>
                          <div className="mini-progress-bar" style={{
                            height: '4px',
                            width: '100%',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            display: 'flex',
                            backgroundColor: '#e9ecef' // Background for non-participated portion
                          }}>
                            {/* Participated portion with vote distribution */}
                            <div style={{
                              width: `${participationRate}%`,
                              height: '100%',
                              display: 'flex'
                            }}>
                              <div style={{
                                width: `${positivePercentage}%`,
                                backgroundColor: '#28a745',
                                height: '100%'
                              }}></div>
                              <div style={{
                                width: `${negativePercentage}%`,
                                backgroundColor: '#dc3545',
                                height: '100%'
                              }}></div>
                              <div style={{
                                width: `${abstainPercentage}%`,
                                backgroundColor: '#6c757d',
                                height: '100%'
                              }}></div>
                            </div>
                            {/* Non-participated portion remains as background */}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </td>

              {/* Enhanced vote progress bars with participation tracking */}
              <td className="text-center votes-column">
                {(() => {
                  // Calculate participation rate for this proposal
                  const totalParticipation = Number(ethers.utils.formatEther(proposal.totalParticipation || 0));
                  const totalSupply = 1000000; // 1M tokens total supply
                  const participationRate = Math.min(100, (totalParticipation / totalSupply) * 100);

                  // Calculate vote amounts for simplified contract
                  const quorumAmount = Number(ethers.utils.formatEther(quorum));

                  // Get actual vote counts from contract mappings
                  const positiveVotes = proposal.forVotes ? Number(ethers.utils.formatEther(proposal.forVotes)) : 0;
                  const negativeVotes = proposal.againstVotes ? Number(ethers.utils.formatEther(proposal.againstVotes)) : 0;

                  // Get actual abstain votes from contract mapping
                  const abstainVotes = proposal.abstainVotes ? Number(ethers.utils.formatEther(proposal.abstainVotes)) : 0;

                  return (
                    <>
                      {/* For votes */}
                      <div className="mb-1">
                        <div className="d-flex justify-content-between">
                          <small className="text-success">For: {positiveVotes} ETH</small>
                          <small className="text-success">{Math.min(100, Math.round((positiveVotes / quorumAmount) * 100))}%</small>
                        </div>
                        <div className="table-progress-bar" style={{
                          height: '6px',
                          width: '100%',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          backgroundColor: '#e9ecef',
                          position: 'relative'
                        }}>
                          {/* Participation background */}
                          <div className="participation-background" style={{
                            height: '100%',
                            width: `${participationRate}%`,
                            position: 'absolute',
                            left: 0
                          }}></div>
                          {/* Actual vote progress */}
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round((positiveVotes / quorumAmount) * 100))}%`,
                            backgroundColor: '#28a745',
                            borderRadius: '3px',
                            position: 'relative',
                            zIndex: 2
                          }}></div>
                        </div>
                      </div>

                      {/* Against votes */}
                      <div className="mb-1">
                        <div className="d-flex justify-content-between">
                          <small className="text-danger">Against: {negativeVotes} ETH</small>
                          <small className="text-danger">{Math.min(100, Math.round((negativeVotes / quorumAmount) * 100))}%</small>
                        </div>
                        <div className="table-progress-bar" style={{
                          height: '6px',
                          width: '100%',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          backgroundColor: '#e9ecef',
                          position: 'relative'
                        }}>
                          {/* Participation background */}
                          <div className="participation-background" style={{
                            height: '100%',
                            width: `${participationRate}%`,
                            position: 'absolute',
                            left: 0
                          }}></div>
                          {/* Actual vote progress */}
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round((negativeVotes / quorumAmount) * 100))}%`,
                            backgroundColor: '#dc3545',
                            borderRadius: '3px',
                            position: 'relative',
                            zIndex: 2
                          }}></div>
                        </div>
                      </div>

                      {/* Abstain votes */}
                      <div className="mb-1">
                        <div className="d-flex justify-content-between">
                          <small className="text-secondary">Abstain: {abstainVotes} ETH</small>
                          <small className="text-secondary">{Math.min(100, Math.round((abstainVotes / quorumAmount) * 100))}%</small>
                        </div>
                        <div className="table-progress-bar" style={{
                          height: '6px',
                          width: '100%',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          backgroundColor: '#e9ecef',
                          position: 'relative'
                        }}>
                          {/* Participation background */}
                          <div className="participation-background" style={{
                            height: '100%',
                            width: `${participationRate}%`,
                            position: 'absolute',
                            left: 0
                          }}></div>
                          {/* Actual vote progress */}
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, Math.round((abstainVotes / quorumAmount) * 100))}%`,
                            backgroundColor: '#6c757d',
                            borderRadius: '3px',
                            position: 'relative',
                            zIndex: 2
                          }}></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </td>

              {/* Action buttons (vote, finalize) based on proposal state */}
              <td className="actions-column">
                <div className="d-flex gap-2 justify-content-center">
                  {/* Enhanced voting buttons - only show if user hasn't voted and proposal isn't cancelled */}
                  {!proposal.finalized && !proposal.cancelled && !userVotes[proposal.id.toString()] && (
                    <div className="voting-interface">
                      {/* Voting power and status indicator */}
                      <div className="proposal-status-indicator mb-2 text-center">
                        <small className="text-muted">
                          💪 Your voting power: <strong>{Number(userTokenBalance).toLocaleString()} tokens</strong>
                        </small>
                        <br />
                        <small className="text-info">
                          {proposal.deadline && proposal.deadline > 0 ? (
                            <>⏰ Deadline: {new Date(proposal.deadline * 1000).toLocaleDateString()}</>
                          ) : (
                            <>⏰ Voting is open - No deadline set</>
                          )}
                        </small>
                      </div>

                      <div className="voting-button-group">
                      <Button
                        className={`vote-btn-for ${votingProposalId === proposal.id ? 'vote-btn-loading' : ''}`}
                        size="sm"
                        disabled={votingProposalId === proposal.id}
                        onClick={() => handleVoteWithConfirmation(proposal.id, 1, proposal.name)}
                    >
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        <>👍 For</>
                      )}
                    </Button>

                    <Button
                      className={`vote-btn-against ${votingProposalId === proposal.id ? 'vote-btn-loading' : ''}`}
                      size="sm"
                      disabled={votingProposalId === proposal.id}
                      onClick={() => handleVoteWithConfirmation(proposal.id, -1, proposal.name)}
                    >
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        <>👎 Against</>
                      )}
                    </Button>

                    <Button
                      className={`vote-btn-abstain ${votingProposalId === proposal.id ? 'vote-btn-loading' : ''}`}
                      size="sm"
                      disabled={votingProposalId === proposal.id}
                      onClick={() => handleVoteWithConfirmation(proposal.id, 2, proposal.name)}
                    >
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        <>🤷 Abstain</>
                      )}
                    </Button>
                    </div>
                    </div>
                  )}

                  {/* Voted badge - show if user has voted but only on active proposals */}
                  {userVotes[proposal.id.toString()] && !proposal.finalized && !proposal.cancelled && (
                    <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '100%' }}>
                      {/* Enhanced badge with vote history information */}
                      <Badge bg="secondary" className="voted-badge mb-1 text-center" style={{
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        maxWidth: '120px',
                        lineHeight: '1.2',
                        padding: '0.5rem'
                      }}>
                        ✅ Your vote has been submitted, thank you!
                      </Badge>

                      {/* Show timestamp and vote type for vote submitted badge */}
                      {userVotes[proposal.id.toString()] && (
                        <small className="text-muted text-center" style={{ fontSize: '0.7rem' }}>
                          <div>
                            Voted: {(() => {
                              const voteValue = userVotes[proposal.id.toString()];

                              if (voteValue === 1) return 'For';
                              if (voteValue === -1) return 'Against';
                              if (voteValue === 2) return 'Abstain';
                              return `Unknown (${voteValue})`;
                            })()}
                          </div>
                          <span title={new Date().toLocaleString()}>
                            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </small>
                      )}
                    </div>
                  )}

                  {/*Added !proposal.cancelled condition to the vote buttons section to hide them when a proposal is cancelled
                      Added !proposal.cancelled condition to the "Already Voted" badge to hide it when a proposal is cancelled
                      Added a new "Voting Closed" badge that appears in the actions column when a proposal is cancelled
                        This ensures that when a proposal is cancelled:
                          The vote buttons are hidden
                          The "Already Voted" badge is hidden
                          A "Voting Closed" badge is shown instead*/}

                  {/* Cancelled badge in actions column */}
                  {proposal.cancelled && (
                    <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '100%' }}>
                      <Badge bg="danger" style={{
                        whiteSpace: 'normal',
                        textAlign: 'center',
                        maxWidth: '80px',
                        wordBreak: 'break-word',
                        hyphens: 'auto',
                        padding: '0.5rem'
                      }}>
                        Voting Closed
                      </Badge>
                      {proposal.timestamp && (
                        <small className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                          {new Date(proposal.timestamp * 1000).toLocaleDateString()} {new Date(proposal.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </small>
                      )}
                    </div>
                  )}

                  {/* Finalize button - only shown if net votes have reached quorum but proposal isn't finalized or cancelled */}
                  {!proposal.finalized && !proposal.cancelled && proposal.votes >= quorum && (
                    <Button
                      variant="success"
                      size="sm"
                      disabled={finalizingProposalId === proposal.id}
                      onClick={() => finalizeHandler(proposal.id)}
                    >
                      {finalizingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> ⏳ Finalizing...</>
                      ) : (
                        '👆Finalize'
                      )}
                    </Button>
                  )}

                  {/* Now checking proposal.positiveVotes >= quorum for the finalize button and proposal.negativeVotes >= quorum for the cancel button, rather than checking proposal.votes >= quorum which is the net votes */}
                  {/* This ensures that the buttons appear when the respective vote counts reach the quorum threshold, regardless of the net vote count. */}

                  {/* Cancel button - only shown if negative net votes have reached quorum but proposal isn't finalized or cancelled */}
                  {!proposal.finalized && !proposal.cancelled && proposal.votes <= -quorum && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={cancellingProposalId === proposal.id}
                      onClick={() => cancelHandler(proposal.id)}
                    >
                      {cancellingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> ⏳ Cancelling...</>
                      ) : (
                        '👆Cancel'
                      )}
                    </Button>
                  )}

                  {/* "Completed" badge - shown if proposal is finalized */}
                  {proposal.finalized && (
                    <div className="text-center w-100">
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>This proposal has been approved and funds have been transferred</Tooltip>}
                      >
                        <div className="d-flex flex-column align-items-center">
                          <Badge bg="success" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>Completed&nbsp; <big>✅</big></Badge>
                          {proposal.timestamp && (
                            <small className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                              {new Date(proposal.timestamp * 1000).toLocaleDateString()} {new Date(proposal.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </small>
                          )}
                        </div>
                      </OverlayTrigger>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}

          {/* Empty state message when no proposals exist */}
          {proposals.length === 0 && (
            <tr>
              <td colSpan="8" className="text-center">No proposals found. Create one to get started!</td>
            </tr>
          )}
        </tbody>
        </Table>
      </div>

      {/* Comments Modal */}
      <Modal show={showCommentsModal} onHide={() => setShowCommentsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            💬 Comments for {selectedProposalForComments?.name || 'Proposal'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProposalForComments && (
            <>
              {/* Comment Mode Toggle */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6>Discussion ({
                  useOnChainComments
                    ? ((proposalComments[selectedProposalForComments.id] && proposalComments[selectedProposalForComments.id]._count !== undefined)
                        ? proposalComments[selectedProposalForComments.id]._count
                        : (proposalComments[selectedProposalForComments.id] || []).length)
                    : (localComments[selectedProposalForComments.id] || []).length
                } comments)</h6>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="commentModeSwitch"
                    checked={useOnChainComments}
                    onChange={(e) => {
                      setUseOnChainComments(e.target.checked);
                      if (e.target.checked) {
                        // Load on-chain comments when switching to on-chain mode
                        loadOnChainComments(selectedProposalForComments.id);
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor="commentModeSwitch">
                    <small>{useOnChainComments ? 'On-Chain (Transparent)' : 'Local (Private)'}</small>
                  </label>
                </div>
              </div>

              {/* Existing Comments */}
              <div className="mb-3">
                {loadingComments ? (
                  <div className="text-center text-muted py-3">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    <span>Loading comments...</span>
                  </div>
                ) : (proposalComments[selectedProposalForComments.id] || []).length === 0 ? (
                  <div className="text-center text-muted py-3">
                    <p>No comments yet. Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  <div className="list-group">
                    {(useOnChainComments
                      ? (proposalComments[selectedProposalForComments.id] || [])
                      : (localComments[selectedProposalForComments.id] || [])
                    ).map((comment, index) => (
                      <div key={index} className="list-group-item">
                        <div className="d-flex w-100 justify-content-between">
                          <h6 className="mb-1">
                            {comment.author === userAddress ? (
                              <span className="text-primary">You ({comment.author.slice(0, 6)}...{comment.author.slice(-4)})</span>
                            ) : (
                              <span className="text-muted">{generateAnonymousName(comment.author)}</span>
                            )}
                          </h6>
                          <small>{new Date(comment.timestamp).toLocaleString()}</small>
                        </div>
                        <p className="mb-1">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Comment Form */}
              <div className="border-top pt-3">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={useOnChainComments ? "Share your thoughts on-chain (transparent)..." : "Share your thoughts locally (private)..."}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        const text = e.target.value.trim();
                        e.target.value = '';

                        if (useOnChainComments) {
                          // Add comment on-chain
                          try {
                            await addOnChainComment(selectedProposalForComments.id, text);
                          } catch (error) {
                            alert('Failed to add comment on-chain: ' + error.message);
                            e.target.value = text; // Restore text on error
                          }
                        } else {
                          // Add comment locally (legacy)
                          const newComment = {
                            author: userAddress,
                            text: text,
                            timestamp: Date.now(),
                            onChain: false
                          };

                          const updatedComments = {
                            ...localComments,
                            [selectedProposalForComments.id]: [...(localComments[selectedProposalForComments.id] || []), newComment]
                          };

                          setLocalComments(updatedComments);
                          localStorage.setItem('daoProposalComments', JSON.stringify(updatedComments));
                        }
                      }
                    }}
                  />
                  <button
                    className="btn btn-outline-primary"
                    type="button"
                    onClick={async (e) => {
                      const input = e.target.parentElement.querySelector('input');
                      if (input.value.trim()) {
                        const text = input.value.trim();
                        input.value = '';

                        if (useOnChainComments) {
                          // Add comment on-chain
                          try {
                            await addOnChainComment(selectedProposalForComments.id, text);
                          } catch (error) {
                            alert('Failed to add comment on-chain: ' + error.message);
                            input.value = text; // Restore text on error
                          }
                        } else {
                          // Add comment locally (legacy)
                          const newComment = {
                            author: userAddress,
                            text: text,
                            timestamp: Date.now(),
                            onChain: false
                          };

                          const updatedComments = {
                            ...localComments,
                            [selectedProposalForComments.id]: [...(localComments[selectedProposalForComments.id] || []), newComment]
                          };

                          setLocalComments(updatedComments);
                          localStorage.setItem('daoProposalComments', JSON.stringify(updatedComments));
                        }
                      }
                    }}
                  >
                    {useOnChainComments ? 'Post On-Chain' : 'Post Locally'}
                  </button>
                </div>
                <small className="text-muted">Press Enter or click Post to add your comment</small>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <br/>
      <div className="alert alert-info mb-3 p-2" style={{ fontSize: '0.85rem' }}>


        <div className="d-flex align-items-center mb-2" style={{ cursor: 'pointer' }} onClick={() => setShowDemoInfo(!showDemoInfo)}>
          <strong>Demo Setup:</strong>
          <span className="ms-2">
            {showDemoInfo ? '▼' : '▶'} Click to {showDemoInfo ? 'hide' : 'show'} deployment details
          </span>
        </div>

        {showDemoInfo && (
          <div className="mt-3">
            <p className="mb-2"><strong>📋 Deployment Order & Operations:</strong></p>
            <p className="mb-1">&nbsp;&nbsp;<strong>1.</strong> Deploy contracts (Token.sol, DAO.sol)</p>
            <p className="mb-1">&nbsp;&nbsp;<strong>2.</strong> Run seed script to distribute tokens to investors</p>
            <p className="mb-1">&nbsp;&nbsp;<strong>3.</strong> Deploy test proposals (optional)</p>
            <p className="mb-3">&nbsp;&nbsp;<strong>5.</strong> Connect with different accounts to test voting functionality</p>

            <p className="mb-2"><strong>🚀 Terminal Deployment Commands:</strong></p>
            <div className="bg-dark text-light p-2 rounded mb-3" style={{
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              display: 'inline-block',
              minWidth: 'fit-content',
              maxWidth: '100%'
            }}>
              <p className="mb-1"><strong>1. Start Hardhat Network:</strong></p>
              <p className="mb-2">&nbsp;&nbsp;<code>npx hardhat node</code></p>

              <p className="mb-1"><strong>2. Deploy Contracts (in new terminal):</strong></p>
              <p className="mb-2">&nbsp;&nbsp;<code>npx hardhat run scripts/deploy.js --network localhost</code></p>

              <p className="mb-1"><strong>3. Seed Test Data:</strong></p>
              <p className="mb-2">&nbsp;&nbsp;<code>npx hardhat run scripts/seed.js --network localhost</code></p>

              <p className="mb-1"><strong>4. Run Tests (optional):</strong></p>
              <p className="mb-2">&nbsp;&nbsp;<code>npx hardhat test</code></p>

              <p className="mb-1"><strong>5. Start Frontend:</strong></p>
              <p className="mb-0">&nbsp;&nbsp;<code>npm start</code></p>

              <p className="mb-0 mt-2"><em>Note: This runs the app without any test proposals</em></p>
            </div>

            <p className="mb-2"><strong>🧪 Deploy with Test Proposals:</strong></p>
            <div className="bg-dark text-light p-2 rounded mb-3" style={{
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              display: 'inline-block',
              minWidth: 'fit-content',
              maxWidth: '100%'
            }}>
              <p className="mb-1"><strong>After step 3 above, run these test scenarios:</strong></p>
              <p className="mb-1">&nbsp;&nbsp;<code>npx hardhat run scripts/test-initial-proposals.js --network localhost</code></p>
              <p className="mb-1">&nbsp;&nbsp;<code>npx hardhat run scripts/test-abstain.js --network localhost</code></p>
              <p className="mb-1">&nbsp;&nbsp;<code>npx hardhat run scripts/test-oppose.js --network localhost</code></p>
              <p className="mb-1">&nbsp;&nbsp;<code>npx hardhat run scripts/test-ready-cancel.js --network localhost</code></p>
              <p className="mb-1">&nbsp;&nbsp;<code>npx hardhat run scripts/test-ready-finalize.js --network localhost</code></p>
              <p className="mb-0">&nbsp;&nbsp;<code>npx hardhat run scripts/test-additional-proposals.js --network localhost</code></p>

              <p className="mb-1 mt-2"><strong>Scenarios:</strong></p>
              <p className="mb-1">&nbsp;&nbsp;• <strong>initial-proposals:</strong> 4 basic proposals with voting patterns</p>
              <p className="mb-1">&nbsp;&nbsp;• <strong>abstain:</strong> proposals with abstain votes to test neutral voting</p>
              <p className="mb-1">&nbsp;&nbsp;• <strong>oppose:</strong> proposals with against votes to test opposition</p>
              <p className="mb-1">&nbsp;&nbsp;• <strong>ready-cancel:</strong> proposals ready for cancellation testing</p>
              <p className="mb-1">&nbsp;&nbsp;• <strong>ready-finalize:</strong> proposals at quorum ready for finalization</p>
              <p className="mb-0">&nbsp;&nbsp;• <strong>additional-proposals:</strong> extra proposals for comprehensive testing</p>
            </div>

            <p className="mb-2"><strong>🔧 Test Instructions:</strong></p>
            <p className="mb-1">&nbsp;&nbsp;• Use MetaMask to switch between Hardhat accounts (localhost:8545)</p>
            <p className="mb-1">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• <em>Import Hardhat accounts using private keys from terminal output</em></p>
            <p className="mb-1">&nbsp;&nbsp;• Test voting, proposal creation, and finalization features</p>
            <p className="mb-3">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• <em>Only token holders can vote and create proposals</em></p>

            <p className="mb-2"><strong>👥 Account Setup:</strong></p>
            <p className="mb-0">&nbsp;&nbsp;account[0] = <strong>deployer</strong>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 0 is the <u>deployer</u> <strong>&</strong> a <u>token holder</u></p>
            <p className="mb-0">&nbsp;&nbsp;account[1] = <strong>investor 1 </strong>
              &nbsp;&nbsp;&nbsp;&nbsp;Hardhat 1 is <u>creator</u> of the deployed proposals <strong>&</strong> a <u>token holder</u></p>
            <p className="mb-0">&nbsp;&nbsp;account[2] = <strong>investor 2</strong>
            &nbsp;&nbsp;&nbsp;&nbsp;Hardhat 3 <strong>is</strong> a <u>token holder</u></p>
            <p className="mb-0">&nbsp;&nbsp;account[3] = <strong>investor 3</strong>
              &nbsp;&nbsp;&nbsp;&nbsp;Hardhat 3 <strong>is</strong> a <u>token holder</u></p>
            <p className="mb-0">&nbsp;&nbsp;account[4] = <strong>recipient</strong>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 4 is <u><strong>NOT</strong> a token holder</u> & therefore <u>cannot vote or create proposals</u></p>
            <p className="mb-3">&nbsp;&nbsp;account[5] = <strong>user</strong></p>

            <p className="mb-2"><strong>💰 Token Distribution:</strong></p>
            <p className="mb-1">&nbsp;&nbsp;&nbsp;&nbsp;<strong>Total supply:</strong> 1,000,000 tokens</p>
            <p className="mb-0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Investor 1:</strong> 200,000 tokens</p>
            <p className="mb-0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Investor 2:</strong> 200,000 tokens</p>
            <p className="mb-1">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Investor 3:</strong> 200,000 tokens</p>
            <p className="mb-3">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Deployer:</strong> 400,000 tokens (remaining)</p>

            <div className="mb-3">
              <h6 className="mb-3" style={{ color: '#495057', fontWeight: 'bold' }}>🗳️ Test Voting Scenarios (All 12 Proposals)</h6>

              {/* test-initial-proposals.js */}
              <div className="mb-3 p-3" style={{
                background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                borderRadius: '8px',
                border: '1px solid #e1bee7'
              }}>
                <h6 className="mb-2" style={{ color: '#4a148c', fontWeight: 'bold' }}>📋 test-initial-proposals.js</h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 1:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Upgrade Smart Contract Security"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👍 → Finalized ✅</strong>
                    </p>
                    <p className="mb-1"><strong>Proposal 2:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Implement New Governance Features"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👍 → Finalized ✅</strong>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 3:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Treasury Management Protocol"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👍 → Finalized ✅</strong>
                    </p>
                    <p className="mb-1"><strong>Proposal 4:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Community Incentive Program"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 400K 👍 → Active for user interaction (100K more needed)</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* test-abstain.js */}
              <div className="mb-3 p-3" style={{
                background: 'linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%)',
                borderRadius: '8px',
                border: '1px solid #f8bbd9'
              }}>
                <h6 className="mb-2" style={{ color: '#e65100', fontWeight: 'bold' }}>🤔 test-abstain.js (neutral stance)</h6>
                <div className="row">
                  <div className="col-12">
                    <p className="mb-1"><strong>Proposal 5:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Controversial Policy Change" or "Uncertain Market Strategy"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-secondary">ABSTAIN</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 200K 👍 | 200K 🤐 → Active (quorum not met)</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* test-oppose.js */}
              <div className="mb-3 p-3" style={{
                background: 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)',
                borderRadius: '8px',
                border: '1px solid #f8bbd9'
              }}>
                <h6 className="mb-2" style={{ color: '#c62828', fontWeight: 'bold' }}>❌ test-oppose.js</h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 6:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Risky Investment Strategy"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👎 → Cancelled ❌ (quorum reached)</strong>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 7:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Unpopular Fee Structure"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • <strong>Total: 400K 👎 → Active (quorum not met)</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* test-ready-cancel.js & test-ready-finalize.js */}
              <div className="mb-3 p-3" style={{
                background: 'linear-gradient(135deg, #e8f5e8 0%, #f3e5f5 100%)',
                borderRadius: '8px',
                border: '1px solid #c8e6c9'
              }}>
                <h6 className="mb-2" style={{ color: '#2e7d32', fontWeight: 'bold' }}>⚡ test-ready-cancel.js & test-ready-finalize.js</h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 8:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Emergency Protocol Update"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👎 → Ready for cancellation testing ⚡</strong>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 9:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Final System Upgrade"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • Investor 3 (0x90F7...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 600K 👍 → Ready for finalization testing ⚡</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* test-additional-proposals.js */}
              <div className="mb-3 p-3" style={{
                background: 'linear-gradient(135deg, #f3e5f5 0%, #e1f5fe 100%)',
                borderRadius: '8px',
                border: '1px solid #b39ddb'
              }}>
                <h6 className="mb-2" style={{ color: '#512da8', fontWeight: 'bold' }}>💬 test-additional-proposals.js (w/ Deadlines & On-chain Comments)</h6>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 10:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Complex Multi-Stakeholder Decision"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Deployer (0xf39F...) voted <span className="badge bg-success">FOR</span> (400K tokens)<br/>
                      • Investor 2 (0x3C44...) voted <span className="badge bg-danger">AGAINST</span> (200K tokens)<br/>
                      • <strong>Total: 400K 👍 | 200K 👎 → Active with comments 💬</strong>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 11:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Comprehensive Community Vote"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • Investor 1 (0x7099...) voted <span className="badge bg-success">FOR</span> (200K tokens)<br/>
                      • <strong>Total: 200K 👍 → Active with 7-day deadline & comments 💬</strong>
                    </p>
                  </div>
                </div>
                <div className="row mt-2">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Proposal 12:</strong> &nbsp;&nbsp;&nbsp;&nbsp;ex: "Long-Term Strategic Plan"</p>
                    <p className="mb-2" style={{ fontSize: '0.9rem', color: '#666' }}>
                      • No votes yet → Active with 14-day deadline & comments 💬<br/>
                      • <strong>Ready for testing deadline functionality</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="alert alert-info" style={{ fontSize: '0.9rem' }}>
                <strong>🔑 Key Testing Info:</strong><br/>
                • <strong>Quorum:</strong> ~501K tokens (51% of 1M total supply)<br/>
                • <strong>Deployer:</strong> 400K tokens (can nearly reach quorum alone)<br/>
                • <strong>Each Investor:</strong> 200K tokens (need 3 to reach quorum)<br/>
                • <strong>Comments:</strong> test-additional-proposals.js includes deployed test comments from multiple investors for demonstration
              </div>

              {/* Second collapsible section for deployment details */}
              <div className="text-center mt-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowDemoInfo(!showDemoInfo)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '4px 12px',
                    borderRadius: '15px'
                  }}
                >
                  {showDemoInfo ? '🔼 Click to hide deployment details' : '🔽 Click to show deployment details'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Proposals;
