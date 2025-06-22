// ========== VOTEDBADGE.JS COMPONENT ==========
/**
 * TEACHING NOTES:
 * 
 * This component creates a reusable "Voted" badge with a tooltip.
 * 
 * Key features:
 * 1. Encapsulation: Isolates the badge UI in its own component for reusability
 * 2. Tooltip Integration: Shows additional context on hover
 * 3. Accessibility: Uses Bootstrap's accessible components
 * 
 * Note: This component has been replaced with inline badge code in Proposals.js
 * to allow for more customized styling and text wrapping behavior.
 * It remains as a reference for how to create reusable UI elements.
 */

import React from 'react';
import Badge from 'react-bootstrap/Badge';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

// imple functional component with no props
// This demonstrates a stateless component pattern - pure UI with no logic
const VotedBadge = () => {
  return (
    // Using OverlayTrigger for tooltip functionality
    // This improves UX by providing additional context on hover
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip>You've voted on this proposal</Tooltip>}
    >
      {/* Using Bootstrap Badge component for consistent styling */}
      {/* The "secondary" variant provides a neutral gray color */}
      <Badge bg="secondary">Voted</Badge>
    </OverlayTrigger>
  );
};

export default VotedBadge;