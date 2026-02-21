// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CuratorRegistry - Collateralized Curation "Tolls" for Certified Bloodstock Agents.
///        Curators stake $ADI to become certified. When they mint a horse, they receive
///        an immutable 5% sourcing fee on future revenue. The platform extracts a service
///        fee from the curator's commission.
contract CuratorRegistry is Ownable, ReentrancyGuard {
    IERC20 public immutable adi;

    uint256 public minimumStake;
    uint16  public sourcingFeeBps = 500;          // 5% sourcing fee for curators
    uint16  public platformServiceFeeBps = 1000;  // 10% platform cut of curator's fee

    struct CuratorInfo {
        uint256 stakedAmount;
        uint256 stakedAt;
        bool    active;
        uint256 totalAssetsSourced;
    }

    mapping(address => CuratorInfo) public curators;

    // tokenId => curator who sourced the asset
    mapping(uint256 => address) public assetCurator;
    mapping(uint256 => uint16)  public assetSourcingFeeBps;

    event CuratorStaked(address indexed curator, uint256 amount);
    event CuratorUnstaked(address indexed curator, uint256 amount);
    event AssetSourced(uint256 indexed tokenId, address indexed curator, uint16 sourcingFeeBps);
    event SourcingFeePaid(uint256 indexed tokenId, address indexed curator, uint256 curatorFee, uint256 platformFee);
    event MinimumStakeUpdated(uint256 newMinimum);
    event FeeParamsUpdated(uint16 sourcingFeeBps, uint16 platformServiceFeeBps);

    constructor(address _adi, uint256 _minimumStake) Ownable(msg.sender) {
        adi = IERC20(_adi);
        minimumStake = _minimumStake;
    }

    /// @notice Stake $ADI to become a Certified Curator
    function stake(uint256 amount) external nonReentrant {
        require(amount >= minimumStake, "Below minimum stake");
        adi.transferFrom(msg.sender, address(this), amount);

        CuratorInfo storage c = curators[msg.sender];
        c.stakedAmount += amount;
        c.stakedAt = block.timestamp;
        c.active = true;
        emit CuratorStaked(msg.sender, amount);
    }

    /// @notice Unstake $ADI and deactivate curator status
    function unstake() external nonReentrant {
        CuratorInfo storage c = curators[msg.sender];
        require(c.active, "Not active curator");
        require(c.stakedAmount > 0, "Nothing staked");

        uint256 amount = c.stakedAmount;
        c.stakedAmount = 0;
        c.active = false;
        adi.transfer(msg.sender, amount);
        emit CuratorUnstaked(msg.sender, amount);
    }

    function isCertifiedCurator(address account) external view returns (bool) {
        CuratorInfo storage c = curators[account];
        return c.active && c.stakedAmount >= minimumStake;
    }

    /// @notice Record that a curator sourced a horse asset (called during mint flow).
    ///         The sourcing fee is immutably tied to the token.
    function recordAssetSourced(uint256 tokenId, address curator) external onlyOwner {
        require(curators[curator].active, "Curator not active");
        require(assetCurator[tokenId] == address(0), "Already sourced");
        assetCurator[tokenId] = curator;
        assetSourcingFeeBps[tokenId] = sourcingFeeBps;
        curators[curator].totalAssetsSourced++;
        emit AssetSourced(tokenId, curator, sourcingFeeBps);
    }

    /// @notice Distribute sourcing fee from revenue. Called by vault or external payer.
    ///         Splits between curator (net) and platform (service fee).
    function distributeSourcingFee(uint256 tokenId, uint256 grossRevenue) external nonReentrant {
        address curator = assetCurator[tokenId];
        require(curator != address(0), "No curator for asset");

        uint16 feeBps = assetSourcingFeeBps[tokenId];
        uint256 totalFee = (grossRevenue * feeBps) / 10000;
        require(totalFee > 0, "Zero fee");

        adi.transferFrom(msg.sender, address(this), totalFee);

        uint256 platformCut = (totalFee * platformServiceFeeBps) / 10000;
        uint256 curatorNet = totalFee - platformCut;

        if (platformCut > 0) {
            adi.transfer(owner(), platformCut);
        }
        adi.transfer(curator, curatorNet);

        emit SourcingFeePaid(tokenId, curator, curatorNet, platformCut);
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    function setMinimumStake(uint256 _minimum) external onlyOwner {
        minimumStake = _minimum;
        emit MinimumStakeUpdated(_minimum);
    }

    function setFeeParams(uint16 _sourcingFeeBps, uint16 _platformServiceFeeBps) external onlyOwner {
        require(_sourcingFeeBps <= 1000, "Max 10%");
        require(_platformServiceFeeBps <= 5000, "Max 50%");
        sourcingFeeBps = _sourcingFeeBps;
        platformServiceFeeBps = _platformServiceFeeBps;
        emit FeeParamsUpdated(_sourcingFeeBps, _platformServiceFeeBps);
    }
}
