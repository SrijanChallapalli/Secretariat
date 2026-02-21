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

/// @title HorseSyndicateVault - SEC-compliant fractional ownership SPV.
///        Enforces Reg D 506(c) accreditation, 90-day Rule 144 lockup, Section 3(c)(1)
///        99-investor cap, protocol fee waterfall, Lazarus Protocol circuit breaker,
///        operating buffer with monthly burn tracking, and dividend audit receipts.
contract HorseSyndicateVault is ERC20, ERC20Votes, Ownable, ReentrancyGuard {
    IERC20 public immutable adi;
    HorseINFT public horseNFT;
    KYCRegistry public kycRegistry;

    uint256 public immutable horseTokenId;
    uint256 public totalShares;
    uint256 public sharePriceADI;

    // -----------------------------------------------------------------------
    // SEC Compliance — Reg D 506(c)
    // -----------------------------------------------------------------------

    uint256 public constant LOCKUP_PERIOD = 90 days;
    uint256 public constant MAX_INVESTORS = 99;

    mapping(address => uint256) public sharesMintedAt;
    mapping(address => bool) public isInvestor;
    uint256 public investorCount;

    // -----------------------------------------------------------------------
    // Revenue architecture & protocol fees
    // -----------------------------------------------------------------------

    address public protocolTreasury;
    uint16 public originationFeeBps;       // 300-500 (3%-5%), taken at share purchase
    uint16 public protocolYieldSkimBps;    // 1000 (10%), taken from yield distribution

    uint256 public claimableRevenue;
    uint256 public operatingBuffer;
    uint256 public bufferTarget;
    uint16 public bufferReplenishBps = 2000; // 20% of post-fee revenue auto-skimmed to buffer

    // -----------------------------------------------------------------------
    // OpEx — Monthly burn tracking ("The Keep")
    // -----------------------------------------------------------------------

    uint256 public monthlyBurnFloor;     // minimum expected monthly OpEx (e.g. 4600 ADI)
    uint256 public monthlyBurnCeiling;   // maximum expected monthly OpEx (e.g. 8208 ADI)
    uint256 public currentMonthBurn;
    uint256 public currentMonthStart;

    // -----------------------------------------------------------------------
    // Lazarus Protocol (Circuit Breaker)
    // -----------------------------------------------------------------------

    bool public frozen;
    bool public insurancePivot;
    uint256 public creditorEscrowEnd;
    uint256 public constant CREDITOR_ESCROW_DAYS = 60 days;
    uint256 public insurancePayout;

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
    mapping(address => bool) public registeredProviders;
    address public agentOperator;
    address public horseOracle; // HorseOracle / StopLossExecutor can trigger Lazarus

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
    event SharesPurchased(address buyer, uint256 shares, uint256 adiSpent, uint256 originationFee);
    event SharesRedeemed(address holder, uint256 shares, uint256 adiReturned);
    event RevenueDeposited(uint256 amount, uint256 toBuffer, uint256 toClaimable);
    event YieldDistributed(uint256 gross, uint256 protocolFee, uint256 toBuffer, uint256 toClaimable);
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
    event DustSwept(uint256 amount);
    event MonthlyBurnWarning(uint256 currentBurn, uint256 ceiling);

    // Lazarus events
    event LazarusTriggered(uint256 indexed horseTokenId, uint256 timestamp);
    event InsurancePayoutDeposited(uint256 amount);
    event CreditorPaid(address indexed creditor, uint256 amount);
    event InsuranceRemainderDistributed(uint256 amount);
    event VaultUnfrozen(uint256 timestamp);

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyKYCAccredited() {
        if (address(kycRegistry) != address(0)) {
            require(kycRegistry.isVerified(msg.sender), "KYC required");
            require(kycRegistry.isCurrentlyAccredited(msg.sender), "Accreditation required");
        }
        _;
    }

    modifier onlyOwnerOrAgent() {
        require(msg.sender == owner() || msg.sender == agentOperator, "Not owner or agent");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || msg.sender == agentOperator || msg.sender == horseOracle,
            "Not authorized"
        );
        _;
    }

    modifier whenNotFrozen() {
        require(!frozen, "Vault frozen - Lazarus Protocol active");
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
        uint256 _bufferTarget,
        address _protocolTreasury,
        uint16  _originationFeeBps,
        uint16  _protocolYieldSkimBps,
        uint256 _monthlyBurnFloor,
        uint256 _monthlyBurnCeiling
    )
        ERC20(
            string(abi.encodePacked("HorseShare_", _horseTokenId)),
            string(abi.encodePacked("SHARE", _horseTokenId))
        )
        EIP712("HorseSyndicateVault", "3")
        Ownable(msg.sender)
    {
        require(_originationFeeBps <= 500, "Origination fee max 5%");
        require(_protocolYieldSkimBps <= 2000, "Yield skim max 20%");
        require(_monthlyBurnCeiling >= _monthlyBurnFloor, "Ceiling < floor");

        adi = IERC20(_adi);
        horseNFT = HorseINFT(_horseNFT);
        horseTokenId = _horseTokenId;
        totalShares = _totalShares;
        sharePriceADI = _sharePriceADI;
        if (_kycRegistry != address(0)) kycRegistry = KYCRegistry(_kycRegistry);

        protocolTreasury = _protocolTreasury;
        originationFeeBps = _originationFeeBps;
        protocolYieldSkimBps = _protocolYieldSkimBps;

        monthlyBurnFloor = _monthlyBurnFloor;
        monthlyBurnCeiling = _monthlyBurnCeiling;
        currentMonthStart = block.timestamp;

        // Pre-funded reserve: buffer must cover at least 3 months of max burn
        if (_monthlyBurnCeiling > 0) {
            require(_bufferTarget >= _monthlyBurnCeiling * 3, "Buffer must cover 3-month runway");
        }
        bufferTarget = _bufferTarget;

        emit VaultCreated(_horseTokenId, _totalShares, _sharePriceADI);
    }

    // -----------------------------------------------------------------------
    // ERC20Votes overrides — SEC compliance enforcement in every transfer
    // -----------------------------------------------------------------------

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        // Lazarus freeze: block all transfers except burns (to == address(0))
        if (frozen && to != address(0)) {
            revert("Vault frozen - Lazarus Protocol active");
        }

        bool isMint = (from == address(0));
        bool isBurn = (to == address(0));

        // --- 90-day lockup enforcement (Rule 144 / Section 4(a)(7)) ---
        if (!isMint && !isBurn) {
            require(
                sharesMintedAt[from] == 0 || block.timestamp >= sharesMintedAt[from] + LOCKUP_PERIOD,
                "90-day lockup active"
            );
        }

        // --- Dark pool: recipient must be KYC + accredited ---
        if (!isBurn && !isMint && address(kycRegistry) != address(0)) {
            require(kycRegistry.isVerified(to), "KYC required for recipient");
            require(kycRegistry.isCurrentlyAccredited(to), "Accreditation required for recipient");
        }

        // --- 99-investor cap (Section 3(c)(1)) ---
        if (to != address(0) && !isInvestor[to] && balanceOf(to) == 0) {
            require(investorCount < MAX_INVESTORS, "99-investor cap reached");
            isInvestor[to] = true;
            investorCount++;
        }

        super._update(from, to, value);

        // Track investor exit
        if (from != address(0) && balanceOf(from) == 0 && isInvestor[from]) {
            isInvestor[from] = false;
            investorCount--;
        }
    }

    function nonces(address owner_) public view override(Nonces) returns (uint256) {
        return super.nonces(owner_);
    }

    // -----------------------------------------------------------------------
    // Share purchase (primary market with origination fee)
    // -----------------------------------------------------------------------

    function buyShares(uint256 numShares) external nonReentrant onlyKYCAccredited whenNotFrozen {
        require(totalSupply() + numShares <= totalShares, "Exceeds total shares");
        uint256 cost = numShares * sharePriceADI;
        adi.transferFrom(msg.sender, address(this), cost);

        // Origination fee to protocol treasury
        uint256 fee = 0;
        if (originationFeeBps > 0 && protocolTreasury != address(0)) {
            fee = (cost * originationFeeBps) / 10000;
            adi.transfer(protocolTreasury, fee);
        }

        uint256 netProceeds = cost - fee;

        // Seed operating buffer from initial share sales if below target
        if (operatingBuffer < bufferTarget && bufferTarget > 0) {
            uint256 bufferGap = bufferTarget - operatingBuffer;
            uint256 toBuffer = netProceeds < bufferGap ? netProceeds : bufferGap;
            operatingBuffer += toBuffer;
        }

        // Record lockup start
        if (sharesMintedAt[msg.sender] == 0) {
            sharesMintedAt[msg.sender] = block.timestamp;
        }

        _mint(msg.sender, numShares);
        emit SharesPurchased(msg.sender, numShares, cost, fee);
    }

    // -----------------------------------------------------------------------
    // Share redemption (NAV-based exit — exempt from lockup since it's a burn)
    // -----------------------------------------------------------------------

    function redeemShares(uint256 numShares) external nonReentrant whenNotFrozen {
        require(balanceOf(msg.sender) >= numShares, "Insufficient shares");
        require(totalSupply() > 0, "No supply");

        uint256 vaultBalance = adi.balanceOf(address(this));
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
    // Revenue — legacy deposit (no protocol fee, for backward compat)
    // -----------------------------------------------------------------------

    function depositRevenue(uint256 amount) external whenNotFrozen {
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
    // Yield distribution — full fee waterfall (race purses, stud fees, etc.)
    //   1. Protocol Management Fee (10%) → protocolTreasury
    //   2. Buffer replenishment
    //   3. Remainder → claimableRevenue for investor dividends
    // -----------------------------------------------------------------------

    function distributeYield(uint256 amount) external whenNotFrozen {
        adi.transferFrom(msg.sender, address(this), amount);

        // 1. Protocol yield skim
        uint256 protocolFee = 0;
        if (protocolYieldSkimBps > 0 && protocolTreasury != address(0)) {
            protocolFee = (amount * protocolYieldSkimBps) / 10000;
            adi.transfer(protocolTreasury, protocolFee);
        }

        uint256 afterFee = amount - protocolFee;

        // 2. Buffer replenishment
        uint256 toBuffer = 0;
        if (operatingBuffer < bufferTarget && bufferReplenishBps > 0) {
            uint256 bufferGap = bufferTarget - operatingBuffer;
            uint256 skimAmount = (afterFee * bufferReplenishBps) / 10000;
            toBuffer = skimAmount < bufferGap ? skimAmount : bufferGap;
            operatingBuffer += toBuffer;
        }

        // 3. Investor dividends
        uint256 toClaimable = afterFee - toBuffer;
        claimableRevenue += toClaimable;
        emit YieldDistributed(amount, protocolFee, toBuffer, toClaimable);
    }

    // -----------------------------------------------------------------------
    // sweepDust — collect rounding dust into operating buffer
    // -----------------------------------------------------------------------

    function sweepDust() external {
        uint256 totalAccounted = claimableRevenue + operatingBuffer + insurancePayout;
        uint256 actualBalance = adi.balanceOf(address(this));
        if (actualBalance > totalAccounted) {
            uint256 dust = actualBalance - totalAccounted;
            operatingBuffer += dust;
            emit DustSwept(dust);
        }
    }

    // -----------------------------------------------------------------------
    // Revenue claims
    // -----------------------------------------------------------------------

    function claim() external nonReentrant whenNotFrozen {
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

    /// @notice Finalize a distribution epoch with an immutable audit receipt
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
    // Lazarus Protocol (Circuit Breaker — Biological Catastrophe)
    // -----------------------------------------------------------------------

    /// @notice Trigger emergency freeze. Callable by oracle or owner when
    ///         a Level 6 biometric failure or Vets' List event is detected.
    function triggerLazarus() external onlyAuthorized {
        require(!frozen, "Already frozen");
        frozen = true;
        insurancePivot = true;
        creditorEscrowEnd = block.timestamp + CREDITOR_ESCROW_DAYS;
        emit LazarusTriggered(horseTokenId, block.timestamp);
    }

    /// @notice Deposit insurance claim payout (5% mortality policy proceeds).
    ///         Locked until creditor escrow period ends.
    function depositInsurancePayout(uint256 amount) external {
        require(insurancePivot, "No active insurance pivot");
        adi.transferFrom(msg.sender, address(this), amount);
        insurancePayout += amount;
        emit InsurancePayoutDeposited(amount);
    }

    /// @notice Pay creditors (vet bills, trainer fees, physical OpEx) during escrow.
    ///         Delaware law requires creditor priority before token holder distribution.
    function payCreditor(address creditor, uint256 amount) external nonReentrant onlyOwnerOrAgent {
        require(insurancePivot, "No active insurance pivot");
        require(block.timestamp <= creditorEscrowEnd, "Escrow period ended");
        require(insurancePayout >= amount, "Insufficient insurance funds");
        insurancePayout -= amount;
        adi.transfer(creditor, amount);
        emit CreditorPaid(creditor, amount);
    }

    /// @notice After 60-day creditor escrow, distribute remaining insurance to token holders.
    function distributeInsuranceRemainder() external nonReentrant {
        require(insurancePivot, "No active insurance pivot");
        require(block.timestamp >= creditorEscrowEnd, "Escrow period not ended");
        require(insurancePayout > 0, "No remainder");

        uint256 remainder = insurancePayout;
        insurancePayout = 0;
        claimableRevenue += remainder;
        emit InsuranceRemainderDistributed(remainder);
    }

    /// @notice Unfreeze the vault if the horse recovers (owner decision).
    function unfreezeVault() external onlyOwner {
        require(frozen, "Not frozen");
        frozen = false;
        insurancePivot = false;
        emit VaultUnfrozen(block.timestamp);
    }

    // -----------------------------------------------------------------------
    // Invoice system (automated OpEx) with monthly burn tracking
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

    /// @notice Pay an approved invoice from the operating buffer.
    ///         Tracks monthly burn and emits warning if approaching ceiling.
    function payInvoice(uint256 invoiceId) external nonReentrant onlyOwnerOrAgent {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.Approved, "Not approved");
        require(operatingBuffer >= inv.amount, "Insufficient buffer");

        // Roll over month if 30 days have passed
        if (block.timestamp >= currentMonthStart + 30 days) {
            currentMonthBurn = 0;
            currentMonthStart = block.timestamp;
        }

        inv.status = InvoiceStatus.Paid;
        operatingBuffer -= inv.amount;
        currentMonthBurn += inv.amount;
        adi.transfer(inv.provider, inv.amount);
        emit InvoicePaid(invoiceId, inv.provider, inv.amount);

        if (monthlyBurnCeiling > 0 && currentMonthBurn > (monthlyBurnCeiling * 90) / 100) {
            emit MonthlyBurnWarning(currentMonthBurn, monthlyBurnCeiling);
        }
    }

    function invoiceCount() external view returns (uint256) {
        return invoices.length;
    }

    /// @notice View current month's burn vs. floor/ceiling
    function monthlyBurnReport() external view returns (
        uint256 spent,
        uint256 floor,
        uint256 ceiling,
        uint256 monthStarted
    ) {
        uint256 effectiveBurn = currentMonthBurn;
        uint256 effectiveStart = currentMonthStart;
        if (block.timestamp >= currentMonthStart + 30 days) {
            effectiveBurn = 0;
            effectiveStart = block.timestamp;
        }
        return (effectiveBurn, monthlyBurnFloor, monthlyBurnCeiling, effectiveStart);
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    function setBufferTarget(uint256 _target) external onlyOwner {
        if (monthlyBurnCeiling > 0) {
            require(_target >= monthlyBurnCeiling * 3, "Buffer must cover 3-month runway");
        }
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

    function setProtocolTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        protocolTreasury = _treasury;
    }

    function setHorseOracle(address _oracle) external onlyOwner {
        horseOracle = _oracle;
    }

    function setMonthlyBurnParams(uint256 _floor, uint256 _ceiling) external onlyOwner {
        require(_ceiling >= _floor, "Ceiling < floor");
        monthlyBurnFloor = _floor;
        monthlyBurnCeiling = _ceiling;
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

    /// @notice Seconds remaining in the 90-day lockup for a given holder.
    function lockupRemaining(address holder) external view returns (uint256) {
        if (sharesMintedAt[holder] == 0) return 0;
        uint256 unlockTime = sharesMintedAt[holder] + LOCKUP_PERIOD;
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }
}
