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

/**
 * Proposals Component - Displays and manages DAO proposals
 * 
 * @param {Object} provider - Ethereum provider from ethers.js
 * @param {Object} dao - DAO contract instance
 * @param {Array} proposals - List of proposals from the blockchain
 * @param {BigNumber} quorum - Minimum votes required to pass a proposal
 * @param {Function} setIsLoading - Function to update loading state in parent component
 */
const Proposals = ({ provider, dao, proposals, quorum, setIsLoading }) => {
  // State variables to track UI states and user data
  const [votingProposalId, setVotingProposalId] = useState(null); // Tracks which proposal is being voted on
  const [finalizingProposalId, setFinalizingProposalId] = useState(null); // Tracks which proposal is being finalized
  
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
    setIsLoading(true);
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
    if (proposal.finalized) {
      return <Badge bg="success" style={{ fontSize: '0.9rem', padding: '0.5rem' }}><small>✓</small> &nbsp;Approved&nbsp; <small>✓</small></Badge>;
    } else if (proposal.votes >= quorum) {
      return <Badge bg="warning" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>Ready to Finalize <big>🤩</big></Badge>;
    } else {
      return <Badge bg="info" style={{ fontSize: '0.9rem', padding: '0.5rem' }}>In Progress <big>😁</big></Badge>;
    }
  };

  /**
   * Helper function to show vote progress with a visual progress bar
   * 
   * @param {BigNumber} votes - Current vote count for the proposal
   * @param {BigNumber} quorumValue - Quorum threshold required
   * @returns {JSX.Element} - Progress bar with vote information
   */

  /* Number Formatting
      This function formats large numbers with K/M/B/T notation for better readability
        & provides tooltips to show exact values on hover*/
  const getVoteProgress = (votes, quorumValue) => {
    const percentage = (votes / quorumValue) * 100;// Calculate percentage of votes compared to quorum
    
    // Format vote count in Ether format for easier reading
    const formatVoteCount = (count) => {
      const etherValue = Number(ethers.utils.formatEther(count));
      if (etherValue >= 1000) {
        return (etherValue / 1000).toFixed(1) + 'K ETH';
      }
      return etherValue.toFixed(1) + ' ETH';
    };
    
    return (
      <div>
        {/* Vote count and percentage display */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>{ethers.utils.formatUnits(votes, 0)} tokens</Tooltip>}
          >
            <small>{formatVoteCount(votes)}</small>
          </OverlayTrigger>
          <small><strong>{Math.min(100, Math.round(percentage))}% of quorum</strong></small>
        </div>
        
        {/* Progress bar container */}
        <div style={{ 
          height: '8px', 
          width: '100%', 
          backgroundColor: '#e9ecef', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          {/* Progress bar fill - changes color blue -> green when quorum is reached */}
          <div style={{ 
            height: '100%', 
            width: `${Math.min(100, Math.round(percentage))}%`, 
            backgroundColor: percentage >= 100 ? '#28a745' : '#007bff',
            borderRadius: '4px'
          }}></div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Component header with title, quorum information, and debug buttons */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-1">Governance Proposals</h4>
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
      
      {/* Responsive table to display all proposals */}
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>#</th>
            <th>Proposal Name</th>
            <th>Recipient</th>
            <th>Recipient Balance</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Votes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* Map through all proposals and create a row for each one */}
          {proposals.map((proposal, index) => (
            <tr key={index}>
              {/* ↑ React requires a unique key for each element/child in a list */}

              {/* Proposal ID */}
              <td>{proposal.id.toString()}</td>
              
              {/* Proposal name with tooltip showing ID */}
              <td>
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Proposal ID: {proposal.id.toString()}</Tooltip>}
                >
                  <span>{proposal.name}</span>
                </OverlayTrigger>
              </td>
              
              {/* Recipient address (shortened) with tooltip showing full address */}
              <td>
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>{proposal.recipient}</Tooltip>}
                >
                  <span>{formatAddress(proposal.recipient)}</span>
                </OverlayTrigger>
              </td>
              
              {/* Recipient balance in ETH */}
              <td>
                {recipientBalances[proposal.recipient] ? 
                  `${parseFloat(recipientBalances[proposal.recipient]).toFixed(4)} ETH` : 
                  <small className="text-muted">Loading...</small>
                }
              </td>
              
              {/* Amount in ETH (converted from wei) */}
              <td>{ethers.utils.formatUnits(proposal.amount, "ether")} ETH</td>
              
              {/* //{proposal.finalized ? 'Approved' : 'In Progress'} */}
              {/* ? = Ternary operator ; return string 'Approved' if proposal.finalized is true, else return 'In Progress' */}
                {/* Now using JSX 'getStatusBadge'function to determine and display status with color-coded badge */}
                {/* ↓ */}
              {/* Status badge (color-coded) */}
              <td className="text-center">{getStatusBadge(proposal)}</td>
              
              {/* Vote progress bar */}
              <td>{getVoteProgress(proposal.votes, quorum)}</td>
              
              {/* Action buttons (vote, finalize) based on proposal state */}
              <td>
                <div className="d-flex gap-2 justify-content-center">
                  {/* Vote button - only show if user hasn't voted */}
                  {!proposal.finalized && !userVotes[proposal.id.toString()] && (
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ width: proposal.votes < quorum ? '100%' : 'auto' }}
                      disabled={votingProposalId === proposal.id}
                      onClick={async () => {
                        const proposalId = proposal.id.toString();
                        console.log(`Attempting to vote on proposal ${proposalId}...`);
                        
                        // Show loading state
                        setVotingProposalId(proposal.id);
                        
                        try {
                          // Call the blockchain transaction
                          const signer = await provider.getSigner();
                          const userAddress = await signer.getAddress();
                          console.log(`User address: ${userAddress}`);
                          
                          // Call the vote function on the contract
                          console.log('Calling vote function on contract...');
                          const transaction = await dao.connect(signer).vote(proposal.id);
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

                        // Error Handling:
                        } catch (error) {
                          console.error('Error voting:', error);
                          if (error.reason) {
                            window.alert(`Transaction failed: ${error.reason}`);
                          } else if (error.message) {
                            window.alert(`Error: ${error.message}`);
                          } else {
                            window.alert('User rejected or transaction reverted');
                          }
                        }
                        
                        // Reset loading state and refresh data
                        setVotingProposalId(null);
                        setIsLoading(true);
                      }}
                    >
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        'Vote'
                      )}
                    </Button>
                  )}
                  
                  {/* Voted badge */}
                  {!proposal.finalized && userVotes[proposal.id.toString()] && (
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
                  
                  {/* Finalize button - only shown if proposal has reached quorum but isn't finalized */}
                  {!proposal.finalized && proposal.votes >= quorum && (/* If proposal is not finalized and has more than the quorum of votes, show "finalize" button */
                    <Button
                      variant="success"
                      size="sm"
                      disabled={finalizingProposalId === proposal.id}
                      onClick={() => finalizeHandler(proposal.id)}
                    >
                      {/* Show spinner when finalizing is in progress */}
                      {finalizingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Finalizing...</>
                      ) : (
                        'Finalize'
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
    </>
  );
}

export default Proposals;
