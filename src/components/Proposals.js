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
  const [userVotes, setUserVotes] = useState({}); // Stores which proposals the user has voted on
  const [recipientBalances, setRecipientBalances] = useState({}); // Stores recipient address balances

  // Effect hook to fetch user data and check voted proposals when component loads or dependencies change
  useEffect(() => {
    const fetchData = async () => {
      if (provider && dao && proposals) {
        try {
          // Initialize all proposals as not voted
          const votedProposals = {};
          const balances = {};
          
          // Get balances for all recipients
          for (const proposal of proposals) {
            votedProposals[proposal.id.toString()] = false;
            
            // Fetch recipient balance
            const balance = await provider.getBalance(proposal.recipient);
            balances[proposal.recipient] = ethers.utils.formatEther(balance);
          }
          setUserVotes(votedProposals);
          setRecipientBalances(balances);
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      }
    };
    fetchData();
  }, [provider, dao, proposals]);

  /**
   * Handle voting on a proposal
   * 
   * @param {BigNumber} id - The ID of the proposal to vote on
   */
  const voteHandler = async (id) => {
    console.log('Casting vote...\n' + 
                 'Proposal ID: ' + id.toString() + '\n' +
                 '----------------------------------------');
    
    // Update UI to show loading state for this specific proposal
    setVotingProposalId(id);
    
    try {
      const signer = await provider.getSigner();// Get the signer (connected wallet) to send the transaction
      
      const transaction = await dao.connect(signer).vote(id);// Call the vote function on the DAO contract
      // This will add the user's token balance to the proposal's vote count
      await transaction.wait();// Wait for the transaction to be mined
      
      // Update local state to show user has voted on this proposal
        // This is important since we can't directly query the votes mapping
      setUserVotes(prev => ({...prev, [id.toString()]: true}));
    } catch (error) {
      console.error("Error voting:", error);// Handle different types of errors with specific messages
      if (error.reason) {
        window.alert(`Transaction failed: ${error.reason}`);// Smart contract revert reason
      } else if (error.message) {
        window.alert(`Error: ${error.message}`);// General error message
      } else {
        window.alert('User rejected or transaction reverted');// Fallback error message
      }
    }

    // Reset loading state and trigger parent component to refresh data
    setVotingProposalId(null);
    setIsLoading(true);
  }

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
      return <Badge bg="success">Approved</Badge>;// Green badge for approved and finalized proposals
    } else if (proposal.votes >= quorum) {
      return <Badge bg="warning">Ready to Finalize</Badge>;// Yellow badge for proposals that reached quorum but aren't finalized
    } else {
      return <Badge bg="info">In Progress</Badge>;// Blue badge for proposals still collecting votes
    }
  };

  /**
   * Helper function to show vote progress with a visual progress bar
   * 
   * @param {BigNumber} votes - Current vote count for the proposal
   * @param {BigNumber} quorumValue - Quorum threshold required
   * @returns {JSX.Element} - Progress bar with vote information
   */
  const getVoteProgress = (votes, quorumValue) => {
    // Calculate percentage of votes compared to quorum
    const percentage = (votes / quorumValue) * 100;
    
    return (
      <div>
        {/* Vote count and percentage display */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <small>{ethers.utils.formatUnits(votes, 0)} votes</small>
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
      {/* Component header with title and quorum information */}
      <h4 className="mb-3">Governance Proposals</h4>
      <p className="text-muted">Quorum required: {ethers.utils.formatUnits(quorum, 0)} votes</p>
      
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
              <td>{getStatusBadge(proposal)}</td>
              
              {/* Vote progress bar */}
              <td>{getVoteProgress(proposal.votes, quorum)}</td>
              
              {/* Action buttons (vote, finalize) based on proposal state */}
              <td>
                <div className="d-flex gap-2">
                  {/* Vote button - only shown if proposal is not finalized and user hasn't voted */}
                  {!proposal.finalized && !userVotes[proposal.id.toString()] && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={votingProposalId === proposal.id}
                      onClick={() => voteHandler(proposal.id)}
                    >
                      {/* Show spinner when voting is in progress */}
                      {votingProposalId === proposal.id ? (
                        <><Spinner as="span" animation="border" size="sm" /> Voting...</>
                      ) : (
                        'Vote'
                      )}
                    </Button>
                  )}
                  
                  {/* "Voted" badge - shown if user has already voted on this proposal */}
                  {userVotes[proposal.id.toString()] && !proposal.finalized && (
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>You've already voted on this proposal</Tooltip>}
                    >
                      <Badge bg="secondary">Voted</Badge>
                    </OverlayTrigger>
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
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>This proposal has been approved and funds have been transferred</Tooltip>}
                    >
                      <Badge bg="success">Completed</Badge>
                    </OverlayTrigger>
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
