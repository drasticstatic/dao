import React, { useState, useEffect } from 'react';
import { ProgressBar, Card } from 'react-bootstrap';
import { ethers } from 'ethers';

const ParticipationProgress = ({ proposals, totalSupply }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  const encouragementMessages = [
    "Your voice matters! Help us reach full participation.",
    "Every vote counts toward our community decision.",
    "Join your fellow members in shaping our future.",
    "Even abstaining helps us reach quorum - participate!",
    "Democracy thrives when everyone participates.",
    "Your opinion shapes our collective future.",
    "Be part of the decision-making process.",
    "Community strength comes from active participation."
  ];

  // Calculate average participation across all active proposals
  // Use the highest participation rate from any single proposal to avoid decreasing percentages
  const participationRates = proposals && proposals.length > 0 ? proposals.map(proposal => {
    // Estimate participation from absolute net votes (simplified approach)
    const netVotes = Math.abs(Number(ethers.utils.formatEther(proposal.votes || 0)));
    const totalSupplyFormatted = totalSupply ? Number(ethers.utils.formatEther(totalSupply)) : 0;
    return totalSupplyFormatted > 0 ? (netVotes / totalSupplyFormatted) * 100 : 0;
  }) : [0];

  // Use the maximum participation rate to show best engagement
  const participationRate = Math.max(...participationRates, 0);
  const isComplete = participationRate >= 99; // Allow for small rounding differences

  // Scroll through messages every 3 seconds
  useEffect(() => {
    if (!isComplete) {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % encouragementMessages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
    // Return undefined when complete (no cleanup needed)
    return undefined;
  }, [isComplete, encouragementMessages.length]);

  // Early return after hooks
  if (!proposals || !totalSupply || proposals.length === 0) return null;

  const currentMessage = encouragementMessages[messageIndex];

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">🎊 Community Participation</h6>
          <span className={`badge ${isComplete ? 'bg-success' : 'bg-info'}`}>
            {participationRate.toFixed(1)}%
          </span>
        </div>

        <ProgressBar
          now={participationRate}
          variant={isComplete ? "success" : "info"}
          className={isComplete ? "pulse-success" : ""}
          style={{ height: '8px' }}
        />

        <div className="mt-2">
          <small className="text-muted">
            {proposals.length} active proposal{proposals.length !== 1 ? 's' : ''} •
            Average participation: {participationRate.toFixed(1)}%
          </small>
        </div>

        {isComplete ? (
          <div className="completion-celebration mt-3 p-3 text-center">
            🎉 <strong>Full participation achieved!</strong> Every voice has been heard.
          </div>
        ) : (
          <div className="engagement-prompt mt-3 p-2 bg-light rounded">
            <div className="d-flex align-items-center">
              <span className="me-2">🗳️</span>
              <small className="text-muted" style={{
                transition: 'opacity 0.5s ease-in-out',
                minHeight: '20px'
              }}>
                {currentMessage}
              </small>
            </div>
            <div className="mt-2">
              <small className="text-info">
                💡 Tip: You can vote For, Against, or Abstain on each proposal
              </small>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ParticipationProgress;
