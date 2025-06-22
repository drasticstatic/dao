//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract DAO {
    address owner; // owner of the contract, usually the deployer
    Token public token; // reference to the Token contract
    uint256 public quorum; // minimum number of votes required to finalize a proposal

    // Structure to hold proposals
    struct Proposal {
        uint256 id; // unique identifier for the proposal
        string name; // name of the proposal
        string description; // description of the proposal to be required
        uint256 amount; // amount of ether requested for the proposal
        address payable recipient; // address of the recipient who will receive the funds
        int256 votes; // net votes (positive votes - negative votes)
        uint256 positiveVotes; // votes in favor
        uint256 negativeVotes; // votes against
        bool finalized; // flag to indicate if the proposal has been finalized true/false
        bool cancelled; // flag to indicate if the proposal has been cancelled
    }

    // Remember: Mapping allows us to store data on the blockchain by key-value pair relationships
    uint256 public proposalCount; // total number of proposals created
    mapping(uint256 => Proposal) public proposals; // mapping to store proposals by their id

    mapping(address => mapping(uint256 => int8)) votes; // mapping to track if an address has voted on a proposal (1 = for, -1 = against, 0 = not voted)
    // Note mapping inside mapping

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
    event Vote(uint256 id, address investor, bool inFavor);
    event Finalize(uint256 id);
    event Cancel(uint256 id);

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

    // Create proposal
    function createProposal(
        string memory _name,
        string memory _description,
        uint256 _amount,
        address payable _recipient // recipient must be 'payable' to receive ether
    ) external onlyInvestor {
        require(address(this).balance >= _amount);// Ensure the contract has enough ether to fund the proposal
        require(_amount > 0, "amount must be greater than 0"); // Ensure the amount is greater than 0
        require(_recipient != address(0), "recipient cannot be zero address"); // Ensure the recipient is not the zero address
        require(bytes(_name).length > 0, "proposal name cannot be empty"); // Ensure the proposal name is not empty
        require(bytes(_description).length > 0, "proposal description cannot be empty"); // Ensure the proposal description is not empty

        proposalCount++; // increment proposal count '++' or ' = proposalCount + 1'
        // '++' is increment operator, it increases the value by 1

        // Create a new proposal and store it in the mapping
            // 'proposals' is a mapping, so we can directly assign a new Proposal to it
                // Inside [] we use the 'proposalCount' as the "key" to store the new proposal
                // = is the assignment operator, it assigns the new Proposal to the mapping
        // 'Proposal' is a struct, so we can create a new instance of it
        // 'Proposal(...)' is the constructor for the Proposal struct, it initializes the fields
        proposals[proposalCount] = Proposal(
            proposalCount,
            _name,
            _description,
            _amount,
            _recipient,
            0, // initial net votes are 0
            0, // initial positive votes are 0
            0, // initial negative votes are 0
            false, // 'not finalized' when initially created
            false  // 'not cancelled' when initially created
        );

        emit Propose(
            proposalCount,
            _name,
            _description,
            _amount,
            _recipient,
            msg.sender
        );
    }

    // Vote on proposal (either in favor or against)
    function vote(uint256 _id, bool _inFavor) external onlyInvestor {
        // Fetch proposal from mapping by id
        Proposal storage proposal = proposals[_id];

        // Don't let investors vote twice
        require(votes[msg.sender][_id] == 0, "already voted");

        // Get voter's token balance
        uint256 voterBalance = token.balanceOf(msg.sender);
        
        if (_inFavor) {
            // Vote in favor - increase positive votes and net votes
            proposal.positiveVotes += voterBalance;
            proposal.votes += int256(voterBalance);
            votes[msg.sender][_id] = 1; // Mark as voted in favor
        } else {
            // Vote against - increase negative votes and decrease net votes
            proposal.negativeVotes += voterBalance;
            proposal.votes -= int256(voterBalance);
            votes[msg.sender][_id] = -1; // Mark as voted against
        }

        // Emit an event
        emit Vote(_id, msg.sender, _inFavor);
    }
    
    // Legacy vote function (always votes in favor) for backward compatibility
    function vote(uint256 _id) external onlyInvestor {
        // Fetch proposal from mapping by id
        Proposal storage proposal = proposals[_id];

        // Don't let investors vote twice
        require(votes[msg.sender][_id] == 0, "already voted");

        // Get voter's token balance
        uint256 voterBalance = token.balanceOf(msg.sender);
        
        // Vote in favor - increase positive votes and net votes
        proposal.positiveVotes += voterBalance;
        proposal.votes += int256(voterBalance);
        votes[msg.sender][_id] = 1; // Mark as voted in favor

        // Emit an event
        emit Vote(_id, msg.sender, true);
    }

    // Finalize proposal & tranfer funds
    function finalizeProposal(uint256 _id) external onlyInvestor {
        // Fetch proposal from mapping by id
        Proposal storage proposal = proposals[_id];// 'storage' keyword allows us to modify the proposal in the mapping

        // Ensure proposal is not already finalized or cancelled
        require(proposal.finalized == false, "proposal already finalized");
        require(proposal.cancelled == false, "proposal was cancelled");

        // Mark proposal as finalized
        proposal.finalized = true;

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
        
        // Check that against votes have reached quorum
        require(proposal.negativeVotes >= quorum, "against votes must reach quorum to cancel proposal");
        
        // Mark proposal as cancelled
        proposal.cancelled = true;
        
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
}