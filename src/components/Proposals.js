// ========== PROPOSALS.JS ==========

// Import necessary React hooks and Bootstrap components
import { useState, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { ethers } from 'ethers';

import ParticipationProgress from './ParticipationProgress';

/**
 * Proposals Component - Displays and manages DAO proposals
 * 
 * @param {Object} provider - Ethereum provider from ethers.js
 * @param {Object} dao - DAO contract instance
 * @param {Array} proposals - List of proposals from the blockchain
 * @param {BigNumber} quorum - Minimum votes required to pass a proposal
 * @param {Function} setIsLoading - Function to update loading state in parent component
 */
const Proposals = ({ provider, dao, proposals, quorum, setIsLoading, loadBlockchainData }) => {
  // State variables to track UI states and user data
  const [votingProposalId, setVotingProposalId] = useState(null); // Tracks which proposal is being voted on
  const [finalizingProposalId, setFinalizingProposalId] = useState(null); // Tracks which proposal is being finalized
  const [cancellingProposalId, setCancellingProposalId] = useState(null); // Tracks which proposal is being cancelled
  
  const [userVotes, setUserVotes] = useState({});/* Vote tracking with state:
    we use this to store votes from blockchain verification
      being more reliable than localStorage as it's always in sync with the blockchain*/
  
  const [recipientBalances, setRecipientBalances] = useState({}); // Stores recipient address balances
  
  useEffect(() => {
    console.log('Current userVotes state:', userVotes);
  }, [userVotes]);// Log userVotes whenever it changes
  
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
          
          // Initialize balances object and votes object
          const balances = {};
          const votesStatus = {};
          
          // Get balances for all recipients and check user votes
          for (const proposal of proposals) {
            // Fetch recipient balance
            const balance = await provider.getBalance(proposal.recipient);
            balances[proposal.recipient] = ethers.utils.formatEther(balance);
            
            // Check if user has voted on this proposal
            try {
              const hasVoted = await dao.hasVoted(userAddress, proposal.id);
              votesStatus[proposal.id.toString()] = hasVoted;
              console.log(`User has voted on proposal ${proposal.id}: ${hasVoted}`);
            } catch (error) {
              console.error(`Error checking vote for proposal ${proposal.id}:`, error);
              votesStatus[proposal.id.toString()] = false;
            }
          }
          
          // Update recipient balances
          setRecipientBalances(balances);
          
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

    // Reload blockchain data to show updated proposal state
    console.log('Finalization successful, reloading data...');
    await loadBlockchainData();
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
    } else if (proposal.negativeVotes >= quorum) {
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

    // Reload blockchain data to show updated proposal state
    console.log('Cancellation successful, reloading data...');
    await loadBlockchainData();
  };

  return (
    <>
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
                
                // Check votes for all proposals
                const votesStatus = {};
                for (const proposal of proposals) {
                  try {
                    const hasVoted = await dao.hasVoted(userAddress, proposal.id);
                    votesStatus[proposal.id.toString()] = hasVoted;
                    console.log(`User has voted on proposal ${proposal.id}: ${hasVoted}`);
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
        </div>
      </div>
      
      {/* Participation Progress for Active Proposals - Show only one combined */}
      {proposals.filter(p => !p.finalized && !p.cancelled).length > 0 && (
        <ParticipationProgress 
          proposals={proposals.filter(p => !p.finalized && !p.cancelled)}
          totalSupply={ethers.utils.parseEther('1000000')} // 1M total supply
        />
      )}
      
      {/* Custom table with fixed header */}
      <div style={{ 
        position: 'relative',
        maxHeight: '875px',
        overflow: 'auto',
        border: '1px solid #dee2e6'
      }}> {/* maxHeight controls amount of viewing area for scrolling list of proposals */}
        <Table striped bordered hover style={{ marginBottom: 0 }}>
          <thead style={{ 
            position: 'sticky', 
            top: 0,
            backgroundColor: 'white',
            zIndex: 10
          }}>
            <tr>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>#</th>
              <th style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Proposal Name</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Amount</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Recipient</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Recipient Balance</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Status</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Votes (% of Quorum)</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Actions</th>
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
                    const totalParticipation = Number(ethers.utils.formatEther(proposal.totalParticipation || 0));
                    const totalSupply = 1000000; // 1M total supply
                    const participationRate = totalSupply > 0 ? (totalParticipation / totalSupply) * 100 : 0;
                    
                    // Calculate vote distribution for this proposal
                    const positiveVotes = Number(ethers.utils.formatEther(proposal.positiveVotes || 0));
                    const negativeVotes = Number(ethers.utils.formatEther(proposal.negativeVotes || 0));
                    const abstainVotes = Number(ethers.utils.formatEther(proposal.abstainVotes || 0));
                    const totalVotes = positiveVotes + negativeVotes + abstainVotes;
                    
                    const positivePercentage = totalVotes > 0 ? (positiveVotes / totalVotes) * 100 : 0;
                    const negativePercentage = totalVotes > 0 ? (negativeVotes / totalVotes) * 100 : 0;
                    const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;
                    
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
              <td className="text-center">
                {(() => {
                  // Calculate participation rate for this proposal
                  const totalParticipation = Number(ethers.utils.formatEther(proposal.totalParticipation || 0));
                  const totalSupply = 1000000; // 1M tokens total supply
                  const participationRate = Math.min(100, (totalParticipation / totalSupply) * 100);

                  // Calculate vote amounts
                  const positiveVotes = Number(ethers.utils.formatEther(proposal.positiveVotes || 0));
                  const negativeVotes = Number(ethers.utils.formatEther(proposal.negativeVotes || 0));
                  const abstainVotes = Number(ethers.utils.formatEther(proposal.abstainVotes || 0));
                  const quorumAmount = Number(ethers.utils.formatEther(quorum));

                  return (
                    <>
                      {/* For votes */}
                      <div className="mb-1">
                        <div className="d-flex justify-content-between">
                          <small className="text-success">For: {ethers.utils.formatEther(proposal.positiveVotes || 0)} ETH</small>
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
                          <small className="text-danger">Against: {ethers.utils.formatEther(proposal.negativeVotes || 0)} ETH</small>
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
                          <small className="text-secondary">Abstain: {ethers.utils.formatEther(proposal.abstainVotes || 0)} ETH</small>
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
              <td>
                <div className="d-flex gap-2 justify-content-center">
                  {/* Enhanced voting buttons - only show if user hasn't voted and proposal isn't cancelled */}
                  {!proposal.finalized && !proposal.cancelled && !userVotes[proposal.id.toString()] && (
                    <div className="voting-button-group">
                      <Button
                        className={`vote-btn-for ${votingProposalId === proposal.id ? 'vote-btn-loading' : ''}`}
                        size="sm"
                        disabled={votingProposalId === proposal.id}
                        onClick={async () => {
                          const proposalId = proposal.id.toString();
                          console.log(`Attempting to vote in favor of proposal ${proposalId}...`);
                          
                          // Show loading state
                          setVotingProposalId(proposal.id);
                          
                          try {
                            // Call the blockchain transaction
                            const signer = await provider.getSigner();
                            const userAddress = await signer.getAddress();
                            console.log(`User address: ${userAddress}`);
                            
                            // Call the vote function on the contract with true for in favor
                            console.log('Calling vote function on contract...');
                            const transaction = await dao.connect(signer)["vote(uint256,bool)"](proposal.id, true);
                            console.log('Transaction sent:', transaction.hash);
                            
                            // Wait for transaction to be mined
                            console.log('Waiting for transaction confirmation...');
                            const receipt = await transaction.wait();
                            console.log('Transaction confirmed:', receipt);
                            
                            // Update vote state after successful transaction
                            console.log('Transaction successful, updating UI state');
                            
                            // Update local state to reflect the vote
                            const newVotes = {...userVotes};
                            newVotes[proposalId] = true;
                            setUserVotes(newVotes);
                            console.log(`Vote recorded for proposal ${proposalId}`);

                            // Vote successful - reload data to show updated state
                            console.log('Vote successful, reloading blockchain data...');
                            setVotingProposalId(null);

                            // Reload blockchain data to show updated proposal state
                            await loadBlockchainData();

                        // Error Handling:
                        } catch (error) {
                          console.error('Error voting:', error);
                          
                          // Check if the error is due to not being a token holder
                          if (error.reason && error.reason.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.message && error.message.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.reason && error.reason.includes('already voted')) {
                            window.alert('You have already voted on this proposal.');
                          } else if (error.message && error.message.includes('user rejected')) {
                            window.alert('Transaction was rejected by the user.');
                          } else if (error.reason) {
                            window.alert(`Transaction failed: ${error.reason}`);
                          } else if (error.message) {
                            window.alert(`Error: ${error.message}`);
                          } else {
                            window.alert('Transaction failed. Please check console for details.');
                          }
                        } finally {
                          // Always reset loading state
                          console.log('Resetting voting state');
                          setVotingProposalId(null);
                        }
                      }}
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
                      onClick={async () => {
                        const proposalId = proposal.id.toString();
                        console.log(`Attempting to vote against proposal ${proposalId}...`);
                        
                        // Show loading state
                        setVotingProposalId(proposal.id);
                        
                        try {
                          // Call the blockchain transaction
                          const signer = await provider.getSigner();
                          const userAddress = await signer.getAddress();
                          console.log(`User address: ${userAddress}`);
                          
                          // Call the vote function on the contract with false for against
                          console.log('Calling vote function on contract...');
                          const transaction = await dao.connect(signer)["vote(uint256,bool)"](proposal.id, false);
                          console.log('Transaction sent:', transaction.hash);
                          
                          // Wait for transaction to be mined
                          console.log('Waiting for transaction confirmation...');
                          const receipt = await transaction.wait();
                          console.log('Transaction confirmed:', receipt);
                          
                          // Update vote state after successful transaction
                          console.log('Transaction successful, updating UI state');
                          
                          // Update local state to reflect the vote
                          const newVotes = {...userVotes};
                          newVotes[proposalId] = true;
                          setUserVotes(newVotes);
                          console.log(`Vote recorded for proposal ${proposalId}`);

                          // Vote successful - reload data to show updated state
                          console.log('Vote successful, reloading blockchain data...');
                          setVotingProposalId(null);

                          // Reload blockchain data to show updated proposal state
                          await loadBlockchainData();

                        // Error Handling:
                        } catch (error) {
                          console.error('Error voting:', error);
                          
                          // Check if the error is due to not being a token holder
                          if (error.reason && error.reason.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.message && error.message.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.reason && error.reason.includes('already voted')) {
                            window.alert('You have already voted on this proposal.');
                          } else if (error.message && error.message.includes('user rejected')) {
                            window.alert('Transaction was rejected by the user.');
                          } else if (error.reason) {
                            window.alert(`Transaction failed: ${error.reason}`);
                          } else if (error.message) {
                            window.alert(`Error: ${error.message}`);
                          } else {
                            window.alert('Transaction failed. Please check console for details.');
                          }
                        } finally {
                          // Always reset loading state
                          console.log('Resetting voting state');
                          setVotingProposalId(null);
                        }
                      }}
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
                      onClick={async () => {
                        const proposalId = proposal.id.toString();
                        console.log(`Attempting to abstain on proposal ${proposalId}...`);

                        // Show loading state
                        setVotingProposalId(proposal.id);

                        try {
                          // Call the blockchain transaction
                          const signer = await provider.getSigner();
                          const userAddress = await signer.getAddress();
                          console.log(`User address: ${userAddress}`);

                          // Call the vote function on the contract with 2 for abstain
                          console.log('Calling vote function on contract...');
                          const transaction = await dao.connect(signer)["vote(uint256,int8)"](proposal.id, 2);
                          console.log('Transaction sent:', transaction.hash);

                          // Wait for transaction to be mined
                          console.log('Waiting for transaction confirmation...');
                          const receipt = await transaction.wait();
                          console.log('Transaction confirmed:', receipt);

                          // Update vote state after successful transaction
                          console.log('Transaction successful, updating UI state');

                          // Update local state to reflect the vote
                          const newVotes = {...userVotes};
                          newVotes[proposalId] = true;
                          setUserVotes(newVotes);
                          console.log(`Abstain vote recorded for proposal ${proposalId}`);

                          // Vote successful - reload data to show updated state
                          console.log('Vote successful, reloading blockchain data...');
                          setVotingProposalId(null);

                          // Reload blockchain data to show updated proposal state
                          await loadBlockchainData();

                        // Error Handling:
                        } catch (error) {
                          console.error('Error voting:', error);

                          // Check if the error is due to not being a token holder
                          if (error.reason && error.reason.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.message && error.message.includes('must be token holder')) {
                            window.alert('You must be a token holder to vote on proposals. Please acquire DAO tokens first.');
                          } else if (error.reason && error.reason.includes('already voted')) {
                            window.alert('You have already voted on this proposal.');
                          } else if (error.message && error.message.includes('user rejected')) {
                            window.alert('Transaction was rejected by the user.');
                          } else if (error.reason) {
                            window.alert(`Transaction failed: ${error.reason}`);
                          } else if (error.message) {
                            window.alert(`Error: ${error.message}`);
                          } else {
                            window.alert('Transaction failed. Please check console for details.');
                          }
                        } finally {
                          // Always reset loading state
                          console.log('Resetting voting state');
                          setVotingProposalId(null);
                        }
                      }}
                    >
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        <>🤷 Abstain</>
                      )}
                    </Button>
                    </div>
                  )}
                  
                  {/* Voted badge - only show if user has voted and proposal isn't cancelled */}
                  {!proposal.finalized && !proposal.cancelled && userVotes[proposal.id.toString()] && (
                    <div className="d-flex align-items-center justify-content-center" style={{ height: '100%' }}>
                      {/* Enhanced badge with proper text wrapping and sizing
                          Uses maxWidth, wordBreak and hyphens for reliable text wrapping
                          Ensures consistent appearance across different screen sizes
                          */}
                      <Badge bg="secondary" style={{ 
                        whiteSpace: 'normal', 
                        textAlign: 'center',
                        maxWidth: '80px',
                        wordBreak: 'break-word',
                        hyphens: 'auto',
                        padding: '0.5rem'
                      }}>
                        Already Voted
                      </Badge>
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
                    <div className="d-flex align-items-center justify-content-center" style={{ height: '100%' }}>
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
                    </div>
                  )}
                  
                  {/* Finalize button - only shown if positive votes have reached quorum but proposal isn't finalized or cancelled */}
                  {!proposal.finalized && !proposal.cancelled && proposal.positiveVotes >= quorum && (
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

                  {/*now checking proposal.positiveVotes >= quorum for the finalize button and proposal.negativeVotes >= quorum for the cancel button, rather than checking proposal.votes >= quorum which is the net votes*/}
                    {/*This ensures that the buttons appear when the respective vote counts reach the quorum threshold, regardless of the net vote count.*/}

                  {/* Cancel button - only shown if negative votes have reached quorum but proposal isn't finalized or cancelled */}
                  {!proposal.finalized && !proposal.cancelled && proposal.negativeVotes >= quorum && (
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
                        <Badge bg="success" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>Completed&nbsp; <big>✅</big></Badge>
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
      <br/>
      <div className="alert alert-info mb-3 p-2" style={{ fontSize: '0.85rem' }}>
        <p className="mb-4">&nbsp;&nbsp;&nbsp;&nbsp;<strong>Create your own proposals using the form above</strong></p>
        <p className="mb-1"><strong>Demo Setup:</strong> Proposals 1-3 are pre-created and finalized upon deployment. Proposal 4 has votes but is not finalized so you can interact with it.</p>
        <p className="mb-0">&nbsp;&nbsp;account[0] = <strong>deployer</strong>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 0 is the <u>deployer</u> & a <u>token holder</u> <em>but</em> did <u>not</u> vote during deployment</p>
        <p className="mb-0">&nbsp;&nbsp;account[1] = <strong>investor 1 </strong>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 1 is creator of the deployed proposals, a <u>token holder</u> & <u>voted in favor</u> for proposal 1-<u>3</u></p>
        <p className="mb-0">&nbsp;&nbsp;account[2] = <strong>investor 2</strong></p>
        <p className="mb-0">&nbsp;&nbsp;account[3] = <strong>investor 3</strong>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 2 & 3 ARE <u>token holders</u> & <u>voted in favor</u> for proposal 1-<u>4</u>
          <em> but</em> did <u>not</u> yet vote for proposal <u>4</u> to avoid reaching quorum to display in-progress example</p>
        <p className="mb-0">&nbsp;&nbsp;account[4] = <strong>recipient</strong>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hardhat 4 is <u>NOT a token holder</u> & therefore <u>cannot vote or create proposals</u></p>
        <p className="mb-3">&nbsp;&nbsp;account[5] = <strong>user</strong></p>
        <p className="mb-1">&nbsp;&nbsp;&nbsp;&nbsp;Hover over proposal names in table above to view descriptions</p>
      </div>
    </>
  );
}

export default Proposals;
