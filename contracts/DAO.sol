//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// Import Hardhat's console for debugging (remove in production)
import "hardhat/console.sol";
// Import our custom Token contract
import "./Token.sol";

/**
 * @title DAO (Decentralized Autonomous Organization)
 * @dev A smart contract that allows token holders to create and vote on proposals
 * @notice This contract implements a basic DAO where token holders can:
 *         - Create proposals requesting funds
 *         - Vote on proposals (For/Against/Abstain)
 *         - Finalize proposals that meet quorum requirements
 *         - Cancel proposals that are rejected by the community
 */
contract DAO {
    // Contract state variables
    address owner; // Address of the owner of the contract, usually the deployer (has special privileges)
    Token public token; // Reference to the ERC-20 token contract used for voting power
    uint256 public quorum; // Minimum voting power required to finalize a proposal

    /**
     * @dev Simplified proposal structure to avoid stack depth issues
     */
    struct Proposal {
        uint256 id; // unique identifier for the proposal
        string name; // name of the proposal
        string description; // description of the proposal to be required
        uint256 amount; // amount of ether requested for the proposal
        address payable recipient; // address of the recipient who will receive the funds, note: recipient must be 'payable' to receive ether
        int256 votes; // Net votes (for/against)
        uint256 deadline; // Deadline for voting (0 means no deadline)
        uint256 timestamp; // Creation/action timestamp
        bool finalized; // flag to indicate if the proposal has been finalized true/false
        bool cancelled; // flag to indicate if the proposal has been cancelled
    }

    // Separate mappings for detailed vote tracking to avoid struct complexity
    mapping(uint256 => uint256) public proposalForVotes;
    mapping(uint256 => uint256) public proposalAgainstVotes;
    mapping(uint256 => uint256) public proposalAbstainVotes;

    /**
     * @dev Comment structure for on-chain proposal discussions
     */
    struct Comment {
        address author;
        string text;
        uint256 timestamp;
        uint256 proposalId;
    }

    // Remember: Mapping allows us to store data on the blockchain by key-value pair relationships
    uint256 public proposalCount; // total number of proposals created
    mapping(uint256 => Proposal) public proposals; // mapping to store proposals by their id

    mapping(address => mapping(uint256 => int8)) votes; // mapping to track if an address has voted on a proposal (1 = for, -1 = against, 2 = abstain, 0 = not voted)
    // Note mapping inside mapping

    // Comment storage for on-chain proposal discussions
    mapping(uint256 => Comment[]) public proposalComments; // proposalId => comments array
    uint256 public totalComments;

    /* Events stream data to the blockchain, so we can listen to them in our frontend
        Events are used to log important actions in the contract
        They are emitted when certain actions occur, like creating a proposal or voting
        Events are important for frontend applications to listen to and update the UI accordingly
        'Propose' event is emitted when a new proposal is created
        'Vote' event is emitted when an investor votes on a proposal
        'Finalize' event is emitted when a proposal is finalized and funds are transferred
        Event stream can fetch previous events from the blockchain, so we can see the history of actions*/
    event Propose(
        uint id,
        string name,
        string description,
        uint256 amount,
        address recipient,
        address creator
    );
    event Vote(uint256 id, address investor, int8 choice); // 1 = for, -1 = against, 2 = abstain
    event Finalize(uint256 id);
    event Cancel(uint256 id);
    event CommentAdded(uint256 indexed proposalId, address indexed author, string text, uint256 timestamp);

    constructor(Token _token, uint256 _quorum) {
        owner = msg.sender;
        token = _token;
        quorum = _quorum;
    }

    // "Receive" function is neccessary to allow contract to receive ether; even if empty
    receive() external payable {} // must be 'external' to receive ether

    /* Must be a DAO token holder to create a proposal or vote
        'onlyInvestor' is a modifier that checks if the sender is a token holder
        'require' is used to check conditions, if condition fails, it reverts the transaction*/
    modifier onlyInvestor() {
        require(
            token.balanceOf(msg.sender) > 0,
            "must be token holder"
        );
        _; // execute the function body after the modifier checks
    }

    // Create proposal w/OUT deadline
    /**
     * @dev Creates a new proposal for the DAO to vote on
     * @notice Simplified version to avoid stack depth issues
     */
    function createProposal(
        string memory _name,
        string memory _description,
        uint256 _amount,
        address payable _recipient // recipient must be 'payable' to receive ether
    ) external onlyInvestor {
        require(address(this).balance >= _amount, "insufficient treasury balance");
        require(_amount > 0, "amount must be greater than zero");
        require(_recipient != address(0), "invalid recipient address - recipient cannot be zero address");
        //require(bytes(_name).length > 0, "proposal name cannot be empty"); // Ensure the proposal name is not empty
        //require(bytes(_description).length > 0, "proposal description cannot be empty"); // Ensure the proposal description is not empty
            // ↑ Handled on the front-end

        proposalCount++; // increment proposal count '++' or ' = proposalCount + 1'
        // '++' is increment operator, it increases the value by 1

        // Create a new proposal and store it in the mapping
            // 'proposals' is a mapping, so we can directly assign a new Proposal to it
                // Inside [] we use the 'proposalCount' as the "key" to store the new proposal
                // = is the assignment operator, it assigns the new Proposal to the mapping
        // 'Proposal' is a struct, so we can create a new instance of it
        // 'Proposal(...)' is the constructor for the Proposal struct, it initializes the fields
        proposals[proposalCount].id = proposalCount;
        proposals[proposalCount].name = _name;
        proposals[proposalCount].description = _description;
        proposals[proposalCount].amount = _amount;
        proposals[proposalCount].recipient = _recipient;
        proposals[proposalCount].votes = 0;
        proposals[proposalCount].deadline = 0;
        proposals[proposalCount].timestamp = block.timestamp;
        proposals[proposalCount].finalized = false;
        proposals[proposalCount].cancelled = false;

        // Initialize separate vote tracking
        proposalForVotes[proposalCount] = 0;
        proposalAgainstVotes[proposalCount] = 0;
        proposalAbstainVotes[proposalCount] = 0;

        emit Propose(proposalCount, _name, _description, _amount, _recipient, msg.sender);
    }

    /**
     * @dev Creates a new proposal WITH DEADLINE
     * @notice Simplified version to avoid stack depth issues
     */
    function createProposalWithDeadline(
        string memory _name,
        string memory _description,
        uint256 _amount,
        address payable _recipient,
        uint256 _deadline
    ) external onlyInvestor {
        require(address(this).balance >= _amount, "insufficient treasury balance");
        require(_amount > 0, "amount must be greater than zero");
        require(_recipient != address(0), "invalid recipient address");
        require(_deadline > block.timestamp, "deadline must be in the future or zero for no deadline");

        proposalCount++;

        proposals[proposalCount].id = proposalCount;
        proposals[proposalCount].name = _name;
        proposals[proposalCount].description = _description;
        proposals[proposalCount].amount = _amount;
        proposals[proposalCount].recipient = _recipient;
        proposals[proposalCount].votes = 0;
        proposals[proposalCount].deadline = _deadline;
        proposals[proposalCount].timestamp = block.timestamp;
        proposals[proposalCount].finalized = false;
        proposals[proposalCount].cancelled = false;

        // Initialize separate vote tracking
        proposalForVotes[proposalCount] = 0;
        proposalAgainstVotes[proposalCount] = 0;
        proposalAbstainVotes[proposalCount] = 0;

        emit Propose(proposalCount, _name, _description, _amount, _recipient, msg.sender);
    }

    /* ========== EDUCATIONAL SECTION: STACK DEPTH SOLUTIONS ==========
     *
     * The two-function approach above solves the "stack too deep" compilation error.
     * This is a common issue in Solidity when functions have too many parameters.
     *
     * PROBLEM: Single function with many parameters causes stack overflow
     * SOLUTION: Split into two functions with different parameter sets
     *
     * ALTERNATIVE SOLUTIONS:
     * 1. Use structs as parameters (but can still cause issues)
     * 2. Split complex functions into smaller internal functions
     * 3. Use storage references instead of memory variables
     * 4. Reduce local variable count in functions
     *
     * The following shows different approaches to the same functionality.
     */

    /* ALTERNATIVE 1: Named Struct Initialization (More Readable)
     *
     * This approach uses named parameters for better readability but can cause
     * stack depth issues with many parameters in complex functions.
     *
     * proposals[proposalCount] = Proposal({
     *     id: proposalCount,
     *     name: _name,
     *     description: _description,
     *     amount: _amount,
     *     recipient: _recipient,
     *     votes: 0,
     *     positiveVotes: 0,
     *     negativeVotes: 0,
     *     abstainVotes: 0,
     *     totalParticipation: 0,
     *     deadline: _deadline,
     *     finalized: false,
     *     cancelled: false
     * });
     */

    /* ALTERNATIVE 2: Storage Reference Approach (Memory Efficient)
     *
     * This approach uses a storage reference to avoid stack depth issues
     * but requires more gas due to multiple SSTORE operations.
     *
     * Proposal storage newProposal = proposals[proposalCount];
     * newProposal.id = proposalCount;
     * newProposal.name = _name;
     * newProposal.description = _description;
     * newProposal.amount = _amount;
     * newProposal.recipient = _recipient;
     * newProposal.votes = 0;
     * newProposal.positiveVotes = 0;
     * newProposal.negativeVotes = 0;
     * newProposal.abstainVotes = 0;
     * newProposal.totalParticipation = 0;
     * newProposal.deadline = _deadline;
     * newProposal.finalized = false;
     * newProposal.cancelled = false;
     */

    /* ALTERNATIVE 3: Memory Struct Then Copy (Hybrid Approach)
     *
     * This approach creates the struct in memory first, then copies to storage.
     * Can be useful for complex validation before storage.
     *
     * Proposal memory tempProposal = Proposal({
     *     id: proposalCount,
     *     name: _name,
     *     description: _description,
     *     amount: _amount,
     *     recipient: _recipient,
     *     votes: 0,
     *     positiveVotes: 0,
     *     negativeVotes: 0,
     *     abstainVotes: 0,
     *     totalParticipation: 0,
     *     deadline: _deadline,
     *     finalized: false,
     *     cancelled: false
     * });
     * proposals[proposalCount] = tempProposal;
     */

    /**
     * @dev Vote on proposal with specific choice (tri-state voting)
     * @param _id Proposal ID to vote on
     * @param _choice Vote choice: 1 = For, -1 = Against, 2 = Abstain
     * @notice This is the main voting function supporting all vote types
     * @notice Only token holders can vote, and each address can only vote once per proposal
     */
    function vote(uint256 _id, int8 _choice) external onlyInvestor {
        _voteWithChoice(_id, _choice);
    }

    /**
     * @dev Vote on proposal with boolean choice (backward compatibility)
     * @param _id Proposal ID to vote on
     * @param _inFavor True for "For", False for "Against"
     * @notice Converts boolean to int8 for internal processing
     */
    function vote(uint256 _id, bool _inFavor) external onlyInvestor {
        _voteWithChoice(_id, _inFavor ? int8(1) : int8(-1));
    }

    /**
     * @dev Legacy vote function (always votes "For"/ inFavor)
     * @param _id Proposal ID to vote on
     * @notice This function exists for backward compatibility
     * @notice Always casts a "For" vote - use other vote functions for more control
     */
    function vote(uint256 _id) external onlyInvestor {
        _voteWithChoice(_id, int8(1));
    }

    /**
     * @dev Internal function to handle voting logic (simplified)
     */
    function _voteWithChoice(uint256 _id, int8 _choice) internal {
        // Fetch proposal from mapping by id:
        Proposal storage proposal = proposals[_id];
        // Don't let investors vote twice:
        require(votes[msg.sender][_id] == 0, "already voted");
        require(_choice == 1 || _choice == -1 || _choice == 2, "invalid choice");

        if (proposal.deadline > 0) {
            require(block.timestamp <= proposal.deadline, "voting deadline has passed");
        }
        // Get voter's token balance
        // This is the voter's voting power, based on their token balance
        uint256 voterBalance = token.balanceOf(msg.sender);

        // Update net votes (for compatibility)
        if (_choice == 1) {
            // Vote in favor
            proposal.votes += int256(voterBalance);
            proposalForVotes[_id] += voterBalance;
        } else if (_choice == -1) {
            // Vote against
            proposal.votes -= int256(voterBalance);
            proposalAgainstVotes[_id] += voterBalance;
        } else if (_choice == 2) {
            // Abstain - only counts toward participation
                // Abstain votes don't affect net count but are tracked separately
            proposalAbstainVotes[_id] += voterBalance;
        }

        votes[msg.sender][_id] = _choice;
        emit Vote(_id, msg.sender, _choice); // Emit an event
    }

    /* ========== EDUCATIONAL: EVOLUTION OF VOTING PATTERNS ==========
     *
     * The following shows how voting logic has evolved in this DAO.
     * Study these patterns to understand different approaches to vote counting.
     */

    /* ORIGINAL SIMPLE VOTING (Binary For/Against Only)
     *
     * This was the original implementation supporting only For/Against votes:
     *
     * function vote(uint256 _id, bool _inFavor) external onlyInvestor {
     *     require(votes[msg.sender][_id] == false, "already voted");
     *
     *     uint256 voterBalance = token.balanceOf(msg.sender);
     *
     *     if (_inFavor) {
     *         proposal.votes += int256(voterBalance);
     *     } else {
     *         proposal.votes -= int256(voterBalance);
     *     }
     *
     *     votes[msg.sender][_id] = true;  // Simple boolean tracking
     *     emit Vote(_id, msg.sender, _inFavor);
     * }
     *
     * LIMITATIONS:
     * - No abstain option
     * - No separate tracking of positive/negative votes
     * - No participation metrics
     * - Boolean vote tracking doesn't preserve vote choice
     */

    /* INTERMEDIATE VOTING (Separate Vote Tracking)
     *
     * This intermediate version added separate positive/negative tracking:
     *
     * if (_inFavor) {
     *     proposal.positiveVotes += voterBalance;
     *     proposal.votes += int256(voterBalance);
     * } else {
     *     proposal.negativeVotes += voterBalance;
     *     proposal.votes -= int256(voterBalance);
     * }
     *
     * IMPROVEMENTS:
     * - Separate tracking enables better analytics
     * - Frontend can show vote distribution
     * - Still limited to binary choices
     */

    /* CURRENT ADVANCED VOTING (Tri-State with Analytics)
     *
     * The current implementation supports:
     * - Three vote types (For/Against/Abstain)
     * - Comprehensive vote tracking
     * - Participation metrics
     * - Deadline enforcement
     * - Choice preservation for potential vote changes
     *
     * This evolution shows how smart contracts can be upgraded
     * conceptually while maintaining backward compatibility.
     */

    // Finalize proposal & tranfer funds
    function finalizeProposal(uint256 _id) external onlyInvestor {
        // Fetch proposal from mapping by id
        Proposal storage proposal = proposals[_id];// 'storage' keyword allows us to modify the proposal in the mapping

        // Ensure proposal is not already finalized or cancelled
        require(proposal.finalized == false, "proposal already finalized");
        require(proposal.cancelled == false, "proposal was cancelled");

        // Mark proposal as finalized with timestamp
        proposal.finalized = true;
        proposal.timestamp = block.timestamp; // Reuse timestamp field for finalization time

        // Check that proposal has enough net votes
        require(proposal.votes >= int256(quorum), "must reach quorum to finalize proposal");

        // Check that the contract has enough ether
        require(address(this).balance >= proposal.amount);

        // Transfer the funds to recipient
        (bool sent, ) = proposal.recipient.call{value: proposal.amount}("");
        require(sent);

        // Emit event
        emit Finalize(_id);
    }

    // Cancel proposal when against votes reach quorum
    function cancelProposal(uint256 _id) external onlyInvestor {
        // Fetch proposal from mapping by id
        Proposal storage proposal = proposals[_id];

        // Ensure proposal is not already finalized or cancelled
        require(proposal.finalized == false, "proposal already finalized");
        require(proposal.cancelled == false, "proposal already cancelled");

        // Check that negative votes have reached quorum (simplified check)
        require(proposal.votes <= -int256(quorum), "must reach quorum to cancel proposal");

        // Mark proposal as cancelled with timestamp
        proposal.cancelled = true;
        proposal.timestamp = block.timestamp; // Reuse timestamp field for cancellation time

        // Emit event
        emit Cancel(_id);
    }

    // Check if an investor has voted on a specific proposal
    function hasVoted(address _investor, uint256 _id) public view returns (bool) {
        return votes[_investor][_id] != 0;
    }

    // Check if an investor has voted in favor of a specific proposal
    function hasVotedInFavor(address _investor, uint256 _id) public view returns (bool) {
        return votes[_investor][_id] == 1;
    }

    // Check if an investor has voted against a specific proposal
    function hasVotedAgainst(address _investor, uint256 _id) public view returns (bool) {
        return votes[_investor][_id] == -1;
    }

    // Check if an investor has abstained on a specific proposal
    function hasAbstained(address _investor, uint256 _id) public view returns (bool) {
        return votes[_investor][_id] == 2;
    }

    // Get voting choice for an investor on a specific proposal
    function getVoteChoice(address _investor, uint256 _id) public view returns (int8) {
        return votes[_investor][_id];
    }

    // Get participation rate for a proposal (simplified - returns 0 for now)
    function getParticipationRate(uint256 /* _id */) public pure returns (uint256) {
        // Simplified implementation - would need to track participation separately
        return 0;
    }

    /**
     * @dev Add a comment to a proposal (on-chain for transparency)
     * @param _proposalId The ID of the proposal to comment on
     * @param _text The comment text
     * @notice Anyone can comment on proposals for transparency
     * @notice Comments are stored on-chain and cannot be deleted
     */
    function addComment(uint256 _proposalId, string memory _text) external {
        require(_proposalId > 0 && _proposalId <= proposalCount, "invalid proposal id");
        require(bytes(_text).length > 0, "comment cannot be empty");
        require(bytes(_text).length <= 500, "comment too long"); // Limit to 500 characters

        // Create new comment
        Comment memory newComment = Comment({
            author: msg.sender,
            text: _text,
            timestamp: block.timestamp,
            proposalId: _proposalId
        });

        // Add to proposal comments
        proposalComments[_proposalId].push(newComment);
        totalComments++;

        // Emit event for frontend integration
        emit CommentAdded(_proposalId, msg.sender, _text, block.timestamp);
    }

    /**
     * @dev Get the number of comments for a proposal
     * @param _proposalId The ID of the proposal
     * @return The number of comments
     */
    function getCommentCount(uint256 _proposalId) external view returns (uint256) {
        return proposalComments[_proposalId].length;
    }

    /**
     * @dev Get a specific comment for a proposal
     * @param _proposalId The ID of the proposal
     * @param _commentIndex The index of the comment
     * @return The comment data
     */
    function getComment(uint256 _proposalId, uint256 _commentIndex) external view returns (Comment memory) {
        require(_commentIndex < proposalComments[_proposalId].length, "comment index out of bounds");
        return proposalComments[_proposalId][_commentIndex];
    }
}
