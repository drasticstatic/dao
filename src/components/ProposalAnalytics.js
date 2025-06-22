import React from 'react';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import { ethers } from 'ethers';

const ProposalAnalytics = ({ proposals, quorum }) => {
  // Calculate analytics data
  const totalProposals = proposals.length;
  const finalizedProposals = proposals.filter(p => p.finalized).length;
  const cancelledProposals = proposals.filter(p => p.cancelled).length;
  const activeProposals = totalProposals - finalizedProposals - cancelledProposals;
  
  // Calculate total votes
  const totalPositiveVotes = proposals.reduce((sum, p) => 
    sum + Number(ethers.utils.formatEther(p.positiveVotes || 0)), 0);
  const totalNegativeVotes = proposals.reduce((sum, p) => 
    sum + Number(ethers.utils.formatEther(p.negativeVotes || 0)), 0);
  const totalVotes = totalPositiveVotes + totalNegativeVotes;
  
  // Calculate percentages
  const positivePercentage = totalVotes > 0 ? (totalPositiveVotes / totalVotes) * 100 : 0;
  const negativePercentage = totalVotes > 0 ? (totalNegativeVotes / totalVotes) * 100 : 0;
  
  // Calculate average votes per proposal
  const avgVotesPerProposal = totalProposals > 0 ? totalVotes / totalProposals : 0;
  
  // Calculate quorum success rate
  const proposalsReachedQuorum = proposals.filter(p => 
    Number(ethers.utils.formatEther(p.positiveVotes || 0)) >= Number(ethers.utils.formatEther(quorum))).length;
  const quorumSuccessRate = totalProposals > 0 ? (proposalsReachedQuorum / totalProposals) * 100 : 0;

  return (
    <div className="mb-4">
      <h4 className="mb-3">Proposal Analytics</h4>
      
      <Row className="g-3">
        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6">Proposal Status</Card.Title>
              <div className="d-flex justify-content-between mb-1">
                <small>Active: {activeProposals}</small>
                <small>Finalized: {finalizedProposals}</small>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <small>Cancelled: {cancelledProposals}</small>
                <small>Total: {totalProposals}</small>
              </div>
              <ProgressBar>
                <ProgressBar variant="info" now={(activeProposals/totalProposals)*100} key={1} />
                <ProgressBar variant="success" now={(finalizedProposals/totalProposals)*100} key={2} />
                <ProgressBar variant="danger" now={(cancelledProposals/totalProposals)*100} key={3} />
              </ProgressBar>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6">Voting Distribution</Card.Title>
              <div className="d-flex justify-content-between mb-1">
                <small className="text-success">For: {totalPositiveVotes.toFixed(1)} ETH</small>
                <small className="text-danger">Against: {totalNegativeVotes.toFixed(1)} ETH</small>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <small className="text-success">{positivePercentage.toFixed(1)}%</small>
                <small className="text-danger">{negativePercentage.toFixed(1)}%</small>
              </div>
              <ProgressBar>
                <ProgressBar variant="success" now={positivePercentage} key={1} />
                <ProgressBar variant="danger" now={negativePercentage} key={2} />
              </ProgressBar>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6">Quorum Success Rate</Card.Title>
              <div className="text-center mb-2">
                <h5>{quorumSuccessRate.toFixed(1)}%</h5>
                <small className="text-muted">{proposalsReachedQuorum} of {totalProposals} proposals reached quorum</small>
              </div>
              <ProgressBar 
                variant={quorumSuccessRate > 66 ? "success" : quorumSuccessRate > 33 ? "warning" : "danger"} 
                now={quorumSuccessRate} 
              />
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6">Average Participation</Card.Title>
              <div className="text-center mb-2">
                <h5>{avgVotesPerProposal.toFixed(1)} ETH</h5>
                <small className="text-muted">Average votes per proposal</small>
              </div>
              <ProgressBar 
                variant="info" 
                now={Math.min(100, (avgVotesPerProposal / Number(ethers.utils.formatEther(quorum))) * 100)} 
              />
              <div className="text-center mt-1">
                <small className="text-muted">
                  {Math.min(100, ((avgVotesPerProposal / Number(ethers.utils.formatEther(quorum))) * 100).toFixed(1))}% of quorum
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProposalAnalytics;
