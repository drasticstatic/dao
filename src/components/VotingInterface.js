import React, { useState } from 'react';
import { Button, ButtonGroup, Alert } from 'react-bootstrap';
import { ethers } from 'ethers';

const VotingInterface = ({ proposal, dao, provider, account, onVoteComplete }) => {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  const voteOptions = [
    { value: 1, label: 'Support', icon: '👍', color: 'success', description: 'Vote in favor of this proposal' },
    { value: -1, label: 'Oppose', icon: '👎', color: 'danger', description: 'Vote against this proposal' },
    { value: 2, label: 'Abstain', icon: '🤐', color: 'secondary', description: 'Abstain but count toward participation' }
  ];

  const handleVote = async () => {
    if (!selectedChoice) return;

    setIsVoting(true);
    try {
      const signer = await provider.getSigner();
      const transaction = await dao.connect(signer)["vote(uint256,int8)"](proposal.id, selectedChoice);
      await transaction.wait();
      
      if (onVoteComplete) {
        onVoteComplete();
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Error submitting vote. Please try again.');
    }
    setIsVoting(false);
  };

  return (
    <div className="voting-interface p-3 border rounded">
      <h6 className="mb-3">Cast Your Vote</h6>
      
      <ButtonGroup className="w-100 mb-3" vertical>
        {voteOptions.map(option => (
          <Button
            key={option.value}
            variant={selectedChoice === option.value ? option.color : `outline-${option.color}`}
            onClick={() => setSelectedChoice(option.value)}
            className="d-flex align-items-center justify-content-start p-3"
            style={{ minHeight: '60px' }}
          >
            <span className="me-3" style={{ fontSize: '1.5rem' }}>{option.icon}</span>
            <div className="text-start">
              <div className="fw-bold">{option.label}</div>
              <small className="text-muted">{option.description}</small>
            </div>
          </Button>
        ))}
      </ButtonGroup>

      <div className="d-grid">
        <Button 
          variant="primary" 
          disabled={!selectedChoice || isVoting}
          onClick={handleVote}
          size="lg"
        >
          {isVoting ? 'Submitting Vote...' : 'Submit Vote'}
        </Button>
      </div>

      <Alert variant="info" className="mt-3 mb-0">
        <small>
          💡 <strong>Note:</strong> Abstaining still counts toward participation and helps reach quorum for community engagement.
        </small>
      </Alert>
    </div>
  );
};

export default VotingInterface;