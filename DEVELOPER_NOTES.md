# Developer Notes: Proposals Component Implementation

This document provides detailed explanations of the implementation choices and code structure in the Proposals component.

## Component Overview

The `Proposals.js` component is responsible for displaying and managing DAO proposals. It allows users to:

1. View all proposals in a table format
2. Vote on active proposals
3. Finalize proposals that have reached quorum
4. See the status and progress of each proposal

## State Management

The component uses React's useState hook to manage several pieces of state:

```javascript
const [votingProposalId, setVotingProposalId] = useState(null);
const [finalizingProposalId, setFinalizingProposalId] = useState(null);
const [userVotes, setUserVotes] = useState({});
```

- `votingProposalId`: Tracks which proposal is currently being voted on (for loading state)
- `finalizingProposalId`: Tracks which proposal is being finalized (for loading state)
- `userVotes`: Object that maps proposal IDs to boolean values indicating if the user has voted

## Handling Solidity Mapping Limitations

One key challenge was accessing the `votes` mapping from the DAO contract:

```solidity
mapping(address => mapping(uint256 => bool)) votes;
```

Since Solidity mappings aren't automatically exposed as functions in the contract ABI, we can't directly call `dao.votes(address, proposalId)`. Instead, we:

1. Initialize all proposals as "not voted" in the component state
2. Update the state when a user successfully votes on a proposal
3. Use this local state to conditionally render UI elements

```javascript
// Update local state after successful vote
setUserVotes(prev => ({...prev, [id.toString()]: true}));
```

## Transaction Handling

The component handles blockchain transactions with proper loading states and error handling:

```javascript
const voteHandler = async (id) => {
  setVotingProposalId(id); // Show loading state
  
  try {
    const signer = await provider.getSigner();
    const transaction = await dao.connect(signer).vote(id);
    await transaction.wait();
    setUserVotes(prev => ({...prev, [id.toString()]: true}));
  } catch (error) {
    // Error handling with specific messages
    console.error("Error voting:", error);
    if (error.reason) {
      window.alert(`Transaction failed: ${error.reason}`);
    } else if (error.message) {
      window.alert(`Error: ${error.message}`);
    } else {
      window.alert('User rejected or transaction reverted');
    }
  }

  setVotingProposalId(null); // Hide loading state
  setIsLoading(true); // Trigger parent component to refresh data
}
```

## UI Helper Functions

Several helper functions improve the UI presentation:

### Address Formatting

```javascript
const formatAddress = (address) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};
```

This function shortens Ethereum addresses to make them more readable.

### Status Badges

```javascript
const getStatusBadge = (proposal) => {
  if (proposal.finalized) {
    return <Badge bg="success">Approved</Badge>;
  } else if (proposal.votes >= quorum) {
    return <Badge bg="warning">Ready to Finalize</Badge>;
  } else {
    return <Badge bg="info">In Progress</Badge>;
  }
};
```

This function returns color-coded badges based on proposal status.

### Vote Progress

```javascript
const getVoteProgress = (votes, quorumValue) => {
  const percentage = (votes / quorumValue) * 100;
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <small>{ethers.utils.formatUnits(votes, 0)} votes</small>
        <small>{Math.min(100, Math.round(percentage))}% of quorum</small>
      </div>
      <div style={{ /* Progress bar container styles */ }}>
        <div style={{ 
          width: `${Math.min(100, Math.round(percentage))}%`, 
          backgroundColor: percentage >= 100 ? '#28a745' : '#007bff',
          /* Other styles */
        }}></div>
      </div>
    </div>
  );
};
```

This function creates a visual progress bar showing how close a proposal is to reaching quorum.

## Conditional Rendering

The component uses conditional rendering extensively to show different UI elements based on proposal state:

```javascript
{!proposal.finalized && !userVotes[proposal.id.toString()] && (
  <Button /* Vote button props */ />
)}

{userVotes[proposal.id.toString()] && !proposal.finalized && (
  <Badge bg="secondary">Voted</Badge>
)}

{!proposal.finalized && proposal.votes >= quorum && (
  <Button /* Finalize button props */ />
)}

{proposal.finalized && (
  <Badge bg="success">Completed</Badge>
)}
```

This approach ensures users only see relevant actions for each proposal.

## Loading States

The component shows loading spinners during blockchain transactions:

```javascript
{votingProposalId === proposal.id ? (
  <><Spinner as="span" animation="border" size="sm" /> Voting...</>
) : (
  'Vote'
)}
```

This provides immediate feedback to users when actions are in progress.

## Best Practices Implemented

1. **Error Handling**: Detailed error messages for different error types
2. **Loading States**: Visual feedback during asynchronous operations
3. **Conditional Rendering**: UI adapts based on data and user actions
4. **Helper Functions**: Code organization for better maintainability
5. **Local State Management**: Working around keeping mapping private in dao.sol
6. **User Feedback**: Tooltips and visual cues for better UX

## Future Improvements

Potential enhancements for the component:

1. Make the DAO custody ERC-20 tokens instead of Ether - e.g. proposals are paid out in USDC
2. Add ability to cancel proposals
3. Add ability to edit proposals before they are voted on
4. Implement vote delegation
5. Add proposal history and analytics
6. Add animations for state transitions