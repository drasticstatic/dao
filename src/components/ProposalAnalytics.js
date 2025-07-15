import React from 'react';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import { ethers } from 'ethers';

const ProposalAnalytics = ({ proposals, quorum }) => {
  // Early return if data not loaded
  if (!proposals || !quorum) {
    return (
      <div className="mb-4">
        <h4 className="mb-3">Proposal Analytics</h4>
        <div className="text-center text-muted">
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Calculate analytics data
  const totalProposals = proposals.length;
  const finalizedProposals = proposals.filter(p => p.finalized).length;
  const cancelledProposals = proposals.filter(p => p.cancelled).length;
  const activeProposals = totalProposals - finalizedProposals - cancelledProposals;

  // Calculate total votes using actual contract fields
  const totalPositiveVotes = proposals.reduce((sum, p) =>
    sum + Number(ethers.utils.formatEther(p.forVotes || 0)), 0);
  const totalNegativeVotes = proposals.reduce((sum, p) =>
    sum + Number(ethers.utils.formatEther(p.againstVotes || 0)), 0);
  const totalAbstainVotes = proposals.reduce((sum, p) =>
    sum + Number(ethers.utils.formatEther(p.abstainVotes || 0)), 0);
  const totalVotes = totalPositiveVotes + totalNegativeVotes + totalAbstainVotes;

  // Calculate percentages
  const positivePercentage = totalVotes > 0 ? (totalPositiveVotes / totalVotes) * 100 : 0;
  const negativePercentage = totalVotes > 0 ? (totalNegativeVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (totalAbstainVotes / totalVotes) * 100 : 0;

  // Calculate average votes per proposal
  const avgVotesPerProposal = totalProposals > 0 ? totalVotes / totalProposals : 0;

  // Calculate quorum success rate
  const proposalsReachedQuorum = proposals.filter(p =>
    Number(ethers.utils.formatEther(p.forVotes || 0)) >= Number(ethers.utils.formatEther(quorum))).length;
  const quorumSuccessRate = totalProposals > 0 ? (proposalsReachedQuorum / totalProposals) * 100 : 0;

  return (
    <div className="mb-4">
      <h4 className="mb-3">Proposal Analytics</h4>

      <Row className="g-3">
        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column">
              <Card.Title className="fs-6">Proposal Status</Card.Title>
              <div className="d-flex justify-content-between mb-1">
                <small>Active: {activeProposals}</small>
                <small>Finalized: {finalizedProposals}</small>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <small>Cancelled: {cancelledProposals}</small>
                <small>Total: {totalProposals}</small>
              </div>
              <div className="mt-auto">
                <ProgressBar>
                  <ProgressBar variant="info" now={(activeProposals/totalProposals)*100} key={1} />
                  <ProgressBar variant="success" now={(finalizedProposals/totalProposals)*100} key={2} />
                  <ProgressBar variant="danger" now={(cancelledProposals/totalProposals)*100} key={3} />
                </ProgressBar>
                <div className="text-center mt-1">
                  <small className="text-muted">
                    {totalProposals > 0 ? 'Proposal distribution overview' : 'No proposals yet'}
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column">
              <Card.Title className="fs-6">Voting Distribution ETH</Card.Title>
              <div className="d-flex justify-content-between mb-1">
                <small className="text-success">For: {totalPositiveVotes.toFixed(1)}</small>
                <small className="text-danger">Against: {totalNegativeVotes.toFixed(1)}</small>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <small className="text-secondary">Abstain: {totalAbstainVotes.toFixed(1)}</small>
                <small className="text-muted">Total: {totalVotes.toFixed(1)}</small>
              </div>
              <div className="mt-auto">
                <ProgressBar>
                  <ProgressBar variant="success" now={positivePercentage} key={1} />
                  <ProgressBar variant="danger" now={negativePercentage} key={2} />
                  <ProgressBar variant="secondary" now={abstainPercentage} key={3} />
                </ProgressBar>
                <div className="text-center mt-1">
                  <small className="text-muted">
                    <span className="text-success">{positivePercentage.toFixed(1)}%</span><big> 👍 &nbsp;&nbsp;</big>
                    <span className="text-danger"> {negativePercentage.toFixed(1)}%</span><big> 👎 &nbsp;&nbsp;</big>
                    <span className="text-secondary"> {abstainPercentage.toFixed(1)}%</span><big> 🤐 </big>
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column">
              <Card.Title className="fs-6">Quorum Success Rate</Card.Title>
              <div className="text-center mb-3">
                <h5>{quorumSuccessRate.toFixed(1)}%</h5>
                <small className="text-muted">{proposalsReachedQuorum} of {totalProposals} proposals reached quorum</small>
              </div>
              <div className="mt-auto">
                <ProgressBar
                  variant={quorumSuccessRate > 66 ? "success" : quorumSuccessRate > 33 ? "warning" : "danger"}
                  now={quorumSuccessRate}
                />
                <div className="text-center mt-1">
                  <small className="text-muted">
                    {quorumSuccessRate > 66 ? 'High success rate' : quorumSuccessRate > 33 ? 'Moderate success' : 'Low success rate'}
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={3}>
          <Card className="h-100">
            <Card.Body className="d-flex flex-column">
              <Card.Title className="fs-6">Average Participation</Card.Title>
              <div className="text-center mb-3">
                <h5>{avgVotesPerProposal.toFixed(1)} ETH</h5>
                <small className="text-muted">Average votes per proposal</small>
              </div>
              <div className="mt-auto">
                <ProgressBar
                  variant="info"
                  now={Math.min(100, (avgVotesPerProposal / Number(ethers.utils.formatEther(quorum))) * 100)}
                />
                <div className="text-center mt-1">
                  <small className="text-muted">
                    {Math.min(100, ((avgVotesPerProposal / Number(ethers.utils.formatEther(quorum))) * 100).toFixed(1))}% of quorum
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProposalAnalytics;
