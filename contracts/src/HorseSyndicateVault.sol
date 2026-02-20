// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./HorseINFT.sol";
import "./KYCRegistry.sol";

/// @title HorseSyndicateVault - Fractional ownership with KYC, operating buffer, invoices,
///        share redemption, governance-ready ERC20Votes, and dividend audit receipts.
contract HorseSyndicateVault is ERC20, ERC20Votes, Ownable, ReentrancyGuard {
    IERC20 public immutable adi;
    HorseINFT public horseNFT;
    KYCRegistry public kycRegistry;

    uint256 public immutable horseTokenId;
    uint256 public totalShares;
    uint256 public sharePriceADI;

    // -----------------------------------------------------------------------
    // Revenue & operating buffer
    // -----------------------------------------------------------------------

    uint256 public claimableRevenue;
    uint256 public operatingBuffer;
    uint256 public bufferTarget;
    uint16 public bufferReplenishBps = 2000; // 20% of revenue auto-skimmed to buffer

    // -----------------------------------------------------------------------
    // Invoice system
    // -----------------------------------------------------------------------

    enum InvoiceStatus { Pending, Approved, Rejected, Paid }

    struct Invoice {
        address provider;
        uint256 amount;
        bytes32 invoiceHash;
        InvoiceStatus status;
        uint256 submittedAt;
    }

    Invoice[] public invoices;
    mapping(address => bool) public registeredProviders; // trainer, vet, etc.
    address public agentOperator; // Kite AI agent address that can approve invoices

    // -----------------------------------------------------------------------
    // Dividend audit receipts
    // -----------------------------------------------------------------------

    struct DividendReceipt {
        uint256 epoch;
        uint256 totalDistributed;
        bytes32 merkleRoot;
        uint256 timestamp;
    }

    DividendReceipt[] public dividendReceipts;
    uint256 public currentEpoch;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event VaultCreated(uint256 indexed horseTokenId, uint256 totalShares, uint256 sharePriceADI);
    event SharesPurchased(address buyer, uint256 shares, uint256 adiSpent);
    event SharesRedeemed(address holder, uint256 shares, uint256 adiReturned);
    event RevenueDeposited(uint256 amount, uint256 toBuffer, uint256 toClaimable);
    event RevenueClaimed(address holder, uint256 amount);
    event BufferTargetUpdated(uint256 newTarget);
    event BufferReplenishBpsUpdated(uint16 newBps);
    event InvoiceSubmitted(uint256 indexed invoiceId, address provider, uint256 amount, bytes32 invoiceHash);
    event InvoiceApproved(uint256 indexed invoiceId, address approver);
    event InvoiceRejected(uint256 indexed invoiceId, address rejector);
    event InvoicePaid(uint256 indexed invoiceId, address provider, uint256 amount);
    event ProviderRegistered(address provider);
    event ProviderRemoved(address provider);
    event AgentOperatorUpdated(address newOperator);
    event DividendReceiptCreated(uint256 indexed epoch, uint256 totalDistributed, bytes32 merkleRoot);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyKYC() {
        require(address(kycRegistry) == address(0) || kycRegistry.isVerified(msg.sender), "KYC required");
        _;
    }

    modifier onlyOwnerOrAgent() {
        require(msg.sender == owner() || msg.sender == agentOperator, "Not owner or agent");
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(
        address _adi,
        address _horseNFT,
        uint256 _horseTokenId,
        uint256 _totalShares,
        uint256 _sharePriceADI,
        address _kycRegistry,
        uint256 _bufferTarget
    )
        ERC20(
            string(abi.encodePacked("HorseShare_", _horseTokenId)),
            string(abi.encodePacked("SHARE", _horseTokenId))
        )
        EIP712("HorseSyndicateVault", "2")
        Ownable(msg.sender)
    {
        adi = IERC20(_adi);
        horseNFT = HorseINFT(_horseNFT);
        horseTokenId = _horseTokenId;
        totalShares = _totalShares;
        sharePriceADI = _sharePriceADI;
        bufferTarget = _bufferTarget;
        if (_kycRegistry != address(0)) kycRegistry = KYCRegistry(_kycRegistry);
        emit VaultCreated(_horseTokenId, _totalShares, _sharePriceADI);
    }

    // -----------------------------------------------------------------------
    // ERC20Votes overrides (resolve diamond inheritance)
    // -----------------------------------------------------------------------

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        if (to != address(0) && from != address(0)) {
            require(
                address(kycRegistry) == address(0) || kycRegistry.isVerified(to),
                "KYC required for recipient"
            );
        }
        super._update(from, to, value);
    }

    function nonces(address owner_) public view override(Nonces) returns (uint256) {
        return super.nonces(owner_);
    }

    // -----------------------------------------------------------------------
    // Share purchase & redemption
    // -----------------------------------------------------------------------

    function buyShares(uint256 numShares) external nonReentrant onlyKYC {
        require(totalSupply() + numShares <= totalShares, "Exceeds total shares");
        uint256 cost = numShares * sharePriceADI;
        adi.transferFrom(msg.sender, address(this), cost);

        // Seed operating buffer from initial share sales if below target
        if (operatingBuffer < bufferTarget && bufferTarget > 0) {
            uint256 bufferGap = bufferTarget - operatingBuffer;
            uint256 toBuffer = cost < bufferGap ? cost : bufferGap;
            operatingBuffer += toBuffer;
        }

        _mint(msg.sender, numShares);
        emit SharesPurchased(msg.sender, numShares, cost);
    }

    /// @notice Redeem shares for pro-rata ADI from the vault backing (NAV-based exit)
    function redeemShares(uint256 numShares) external nonReentrant {
        require(balanceOf(msg.sender) >= numShares, "Insufficient shares");
        require(totalSupply() > 0, "No supply");

        uint256 vaultBalance = adi.balanceOf(address(this));
        // Exclude operating buffer from redeemable pool
        uint256 redeemablePool = vaultBalance > operatingBuffer ? vaultBalance - operatingBuffer : 0;
        uint256 payout = (redeemablePool * numShares) / totalSupply();
        require(payout > 0, "Nothing to redeem");

        _burn(msg.sender, numShares);
        if (claimableRevenue > payout) {
            claimableRevenue -= payout;
        } else {
            claimableRevenue = 0;
        }
        adi.transfer(msg.sender, payout);
        emit SharesRedeemed(msg.sender, numShares, payout);
    }

    // -----------------------------------------------------------------------
    // Revenue deposit (auto-skim to buffer, rest to claimable)
    // -----------------------------------------------------------------------

    function depositRevenue(uint256 amount) external {
        adi.transferFrom(msg.sender, address(this), amount);

        uint256 toBuffer = 0;
        if (operatingBuffer < bufferTarget && bufferReplenishBps > 0) {
            uint256 bufferGap = bufferTarget - operatingBuffer;
            uint256 skimAmount = (amount * bufferReplenishBps) / 10000;
            toBuffer = skimAmount < bufferGap ? skimAmount : bufferGap;
            operatingBuffer += toBuffer;
        }

        uint256 toClaimable = amount - toBuffer;
        claimableRevenue += toClaimable;
        emit RevenueDeposited(amount, toBuffer, toClaimable);
    }

    // -----------------------------------------------------------------------
    // Revenue claims with audit receipt
    // -----------------------------------------------------------------------

    function claim() external nonReentrant {
        uint256 shares = balanceOf(msg.sender);
        require(shares > 0 && totalSupply() > 0, "No shares");
        uint256 amount = (claimableRevenue * shares) / totalSupply();
        require(amount > 0, "Nothing to claim");
        claimableRevenue -= amount;
        adi.transfer(msg.sender, amount);
        emit RevenueClaimed(msg.sender, amount);
    }

    function claimableFor(address account) external view returns (uint256) {
        uint256 shares = balanceOf(account);
        if (totalSupply() == 0 || shares == 0) return 0;
        return (claimableRevenue * shares) / totalSupply();
    }

    /// @notice Finalize a distribution epoch, recording an immutable audit receipt
    function createDividendReceipt(uint256 totalDistributed, bytes32 merkleRoot) external onlyOwnerOrAgent {
        uint256 epoch = currentEpoch++;
        dividendReceipts.push(DividendReceipt({
            epoch: epoch,
            totalDistributed: totalDistributed,
            merkleRoot: merkleRoot,
            timestamp: block.timestamp
        }));
        emit DividendReceiptCreated(epoch, totalDistributed, merkleRoot);
    }

    function getDividendReceipt(uint256 epoch) external view returns (DividendReceipt memory) {
        require(epoch < dividendReceipts.length, "Invalid epoch");
        return dividendReceipts[epoch];
    }

    function dividendReceiptCount() external view returns (uint256) {
        return dividendReceipts.length;
    }

    // -----------------------------------------------------------------------
    // Invoice system (automated OpEx)
    // -----------------------------------------------------------------------

    function registerProvider(address provider) external onlyOwner {
        registeredProviders[provider] = true;
        emit ProviderRegistered(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        registeredProviders[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setAgentOperator(address _agent) external onlyOwner {
        agentOperator = _agent;
        emit AgentOperatorUpdated(_agent);
    }

    function submitInvoice(uint256 amount, bytes32 invoiceHash) external returns (uint256 invoiceId) {
        require(registeredProviders[msg.sender], "Not registered provider");
        require(amount > 0, "Zero amount");
        invoiceId = invoices.length;
        invoices.push(Invoice({
            provider: msg.sender,
            amount: amount,
            invoiceHash: invoiceHash,
            status: InvoiceStatus.Pending,
            submittedAt: block.timestamp
        }));
        emit InvoiceSubmitted(invoiceId, msg.sender, amount, invoiceHash);
    }

    function approveInvoice(uint256 invoiceId) external onlyOwnerOrAgent {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Pending, "Not pending");
        inv.status = InvoiceStatus.Approved;
        emit InvoiceApproved(invoiceId, msg.sender);
    }

    function rejectInvoice(uint256 invoiceId) external onlyOwnerOrAgent {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Pending, "Not pending");
        inv.status = InvoiceStatus.Rejected;
        emit InvoiceRejected(invoiceId, msg.sender);
    }

    /// @notice Pay an approved invoice from the operating buffer
    function payInvoice(uint256 invoiceId) external nonReentrant onlyOwnerOrAgent {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Approved, "Not approved");
        require(operatingBuffer >= inv.amount, "Insufficient buffer");

        inv.status = InvoiceStatus.Paid;
        operatingBuffer -= inv.amount;
        adi.transfer(inv.provider, inv.amount);
        emit InvoicePaid(invoiceId, inv.provider, inv.amount);
    }

    function invoiceCount() external view returns (uint256) {
        return invoices.length;
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    function setBufferTarget(uint256 _target) external onlyOwner {
        bufferTarget = _target;
        emit BufferTargetUpdated(_target);
    }

    function setBufferReplenishBps(uint16 _bps) external onlyOwner {
        require(_bps <= 5000, "Max 50%");
        bufferReplenishBps = _bps;
        emit BufferReplenishBpsUpdated(_bps);
    }

    function setKYCRegistry(address _kycRegistry) external onlyOwner {
        kycRegistry = KYCRegistry(_kycRegistry);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function tvl() external view returns (uint256) {
        return adi.balanceOf(address(this));
    }

    function navPerShare() external view returns (uint256) {
        if (totalSupply() == 0) return 0;
        uint256 vaultBalance = adi.balanceOf(address(this));
        uint256 redeemablePool = vaultBalance > operatingBuffer ? vaultBalance - operatingBuffer : 0;
        return (redeemablePool * 1e18) / totalSupply();
    }
}
