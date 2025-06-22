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
          <h4 className="mb-1">Governance | Proposals</h4>
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
      
      {/* Custom table with fixed header */}
      <div style={{ 
        position: 'relative',
        maxHeight: '333px',
        overflow: 'auto',
        border: '1px solid #dee2e6'
      }}>
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
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Votes</th>
              <th className="text-center" style={{ backgroundColor: 'white', position: 'sticky', top: 0, boxShadow: '0 2px 3px rgba(0,0,0,0.1)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Map through all proposals in reverse order (most recent first) */}
            {/*Created a Copy of the Proposals Array using the spread operator [...proposals] to create a new arra to avoidmutating the original array which could cause side effects*/}
            {/* ↓ */}
            {[...proposals].reverse().map((proposal, index) => (
            <tr key={index}>
              {/* ↑ React requires a unique key for each element/child in a list */}

              {/* Proposal ID */}
              <td className="text-center">{proposal.id.toString()}</td>
              
              {/* Proposal name with tooltip showing description */}
              <td>
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>
                    <div>
                      <strong>ID:</strong> {proposal.id.toString()}<br/>
                      <strong>Description:</strong> {proposal.description || "No description provided"}
                    </div>
                  </Tooltip>}
                  >
                  <span>{proposal.name}</span>
                </OverlayTrigger>
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
              {/* Status badge (color-coded) */}
              <td className="text-center">{getStatusBadge(proposal)}</td>
              
              {/* Vote progress bar */}
              <td className="text-center">{getVoteProgress(proposal.votes, quorum)}</td>
              
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
      </div>
      <br/>
      <div className="alert alert-info mb-3 p-2" style={{ fontSize: '0.85rem' }}>
        <p className="mb-1"><strong>Demo Setup:</strong> Proposals 1-3 are pre-created and finalized upon deployment. Proposal 4 has votes but is not finalized so you can interact with it.</p>
        <p className="mb-0">&nbsp;&nbsp;Hardhat 0 is the <u>deployer</u> & a <u>token holder</u> <em>but</em> did <u>not</u> vote during deployment</p>
        <p className="mb-0">&nbsp;&nbsp;Hardhat 1 is creator of the deployed proposals, a <u>token holder</u> & <u>voted in favor</u> for proposal 1-<u>3</u></p>
        <p className="mb-0">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<em>but</em> did <u>not</u> yet vote for proposal <u>4</u> to avoid reaching quorum upon deployment in order to display in-progress/unfinalized example</p>
        <p className="mb-0">&nbsp;&nbsp;Hardhat 2 & 3 ARE <u>token holders</u> & <u>voted in favor</u> for proposal 1-<u>4</u></p>
        <p className="mb-1">&nbsp;&nbsp;Hardhat 4 is <u>NOT a token holder</u> & therefore <u>cannot vote or create proposals</u></p>
        <p className="mb-0">Hover over proposal names to see descriptions. <strong>Create your own proposals using the form above.</strong></p>
      </div>
    </>
  );
}

export default Proposals;
