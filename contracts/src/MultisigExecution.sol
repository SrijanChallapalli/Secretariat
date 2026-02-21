// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MultisigExecution - N-of-M multisig executor for governance proposals.
///        Human signers retain 100% legal execution authority. The AI/Governor proposes,
///        humans confirm via N-of-M threshold, then the proposal executes atomically.
contract MultisigExecution is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold; // N required confirmations

    struct Proposal {
        bytes32 proposalHash;
        address target;
        uint256 value;
        bytes   data;
        uint256 confirmations;
        bool    executed;
        uint256 submittedAt;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasConfirmed;
    uint256 public proposalCount;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event ProposalSubmitted(uint256 indexed proposalId, bytes32 proposalHash, address target, address submitter);
    event ProposalConfirmed(uint256 indexed proposalId, address indexed signer, uint256 confirmations);
    event ProposalExecuted(uint256 indexed proposalId, bytes32 proposalHash, bool success);
    event ProposalRevoked(uint256 indexed proposalId, address indexed signer);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdUpdated(uint256 newThreshold);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlySigner() {
        require(isSigner[msg.sender], "Not a signer");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only via execution");
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(address[] memory _signers, uint256 _threshold) {
        require(_signers.length >= _threshold, "Threshold exceeds signers");
        require(_threshold > 0, "Zero threshold");

        for (uint256 i = 0; i < _signers.length; i++) {
            address s = _signers[i];
            require(s != address(0), "Zero signer");
            require(!isSigner[s], "Duplicate signer");
            isSigner[s] = true;
            signers.push(s);
            emit SignerAdded(s);
        }
        threshold = _threshold;
    }

    // -----------------------------------------------------------------------
    // Proposal lifecycle
    // -----------------------------------------------------------------------

    /// @notice Submit a governance proposal for multisig confirmation.
    ///         Can be called by the SyndicateGovernor or any signer.
    function submitProposal(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256 proposalId) {
        bytes32 proposalHash = keccak256(abi.encode(target, value, data, block.timestamp, proposalCount));

        proposalId = proposalCount++;
        proposals[proposalId] = Proposal({
            proposalHash: proposalHash,
            target: target,
            value: value,
            data: data,
            confirmations: 0,
            executed: false,
            submittedAt: block.timestamp
        });

        emit ProposalSubmitted(proposalId, proposalHash, target, msg.sender);
    }

    /// @notice Confirm a pending proposal. Once N confirmations are reached, it can be executed.
    function confirmProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(!hasConfirmed[proposalId][msg.sender], "Already confirmed");

        hasConfirmed[proposalId][msg.sender] = true;
        p.confirmations++;
        emit ProposalConfirmed(proposalId, msg.sender, p.confirmations);
    }

    /// @notice Revoke a previous confirmation
    function revokeConfirmation(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(hasConfirmed[proposalId][msg.sender], "Not confirmed");

        hasConfirmed[proposalId][msg.sender] = false;
        p.confirmations--;
        emit ProposalRevoked(proposalId, msg.sender);
    }

    /// @notice Execute a proposal once it has reached the confirmation threshold.
    function executeProposal(uint256 proposalId) external onlySigner nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(p.confirmations >= threshold, "Insufficient confirmations");

        p.executed = true;

        (bool success, ) = p.target.call{value: p.value}(p.data);
        emit ProposalExecuted(proposalId, p.proposalHash, success);
        require(success, "Execution failed");
    }

    // -----------------------------------------------------------------------
    // Signer management (only via self-execution, i.e. through a proposal)
    // -----------------------------------------------------------------------

    function addSigner(address signer) external onlySelf {
        require(signer != address(0), "Zero address");
        require(!isSigner[signer], "Already signer");
        isSigner[signer] = true;
        signers.push(signer);
        emit SignerAdded(signer);
    }

    function removeSigner(address signer) external onlySelf {
        require(isSigner[signer], "Not a signer");
        require(signers.length - 1 >= threshold, "Would break threshold");
        isSigner[signer] = false;

        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        emit SignerRemoved(signer);
    }

    function updateThreshold(uint256 newThreshold) external onlySelf {
        require(newThreshold > 0, "Zero threshold");
        require(newThreshold <= signers.length, "Threshold exceeds signers");
        threshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function signerCount() external view returns (uint256) {
        return signers.length;
    }

    function isConfirmedBy(uint256 proposalId, address signer) external view returns (bool) {
        return hasConfirmed[proposalId][signer];
    }

    receive() external payable {}
}
