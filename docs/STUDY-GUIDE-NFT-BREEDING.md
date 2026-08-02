# Secretariat — Horse NFT, Breeding & Minting Study Guide

Everything verified against the code as of 2026-08-02.

---

## 0. The 30-second frame

A horse is an **ERC-721 NFT whose entire state lives on-chain** — traits,
pedigree, valuation, health flags. Breeding is a marketplace where stallion
owners sell time-boxed *breeding rights*, and the offspring's genetics are
computed **deterministically inside the contract** from a seed committed at
purchase time.

The three properties worth leading with:

1. **Genetics are on-chain and reproducible** — anyone can recompute a foal
   from public inputs and verify nothing was fudged.
2. **The seed is committed before the outcome is known** — you can't shop for
   good offspring.
3. **Domain rules are enforced in the contract, not the UI** — injury blocks
   breeding at the `require` level; a different frontend can't route around it.

---

## 1. The NFT: `HorseINFT.sol`

`ERC721 + Ownable`, name `"Secretariat Horse"`, symbol `SHORSE`.

### 1.1 The state — everything is on-chain

```solidity
struct HorseData {
    string  name;
    uint64  birthTimestamp;
    uint256 sireId;          // 0 for founder horses
    uint256 damId;
    uint8[8] traitVector;    // speed, stamina, temperament, conformation,
                             // health, agility, raceIQ, consistency
    uint16  pedigreeScore;   // 0–10000
    uint256 valuationADI;
    bytes32 dnaHash;
    bool    breedingAvailable;
    bool    injured;
    bool    retired;
    bool    xFactorCarrier;  // enlarged-heart gene
    string  encryptedURI;    // 0G Storage pointer
    bytes32 metadataHash;
}
mapping(uint256 => HorseData) public horses;
```

> **Point worth making:** most NFT projects store a tokenURI pointing at
> off-chain JSON. Here the *semantic* state — traits, pedigree, health — is
> on-chain, because contracts need to read it. `BreedingMarketplace` reads
> `traitVector` to compute genetics; it couldn't do that with an IPFS link.
> `encryptedURI` holds the *private* payload separately.

### 1.2 Access control — three distinct authorities

| Function | Who can call | Why |
|---|---|---|
| `mint` | `owner()` **or** `breedingMarketplace` | seeding + births |
| `updateValuation`, `setInjured`, `setRetired` | `owner()` **or** `horseOracle` | real-world events |
| `setBreedingAvailable` | `owner()` only | not oracle-driven |
| `authorizeUsage`, `revokeAuthorization` | `ownerOf(tokenId)` | the holder's own grant |

`modifier onlyOwnerOrOracle` is the key one — it's how off-chain race results
mutate on-chain state without giving the oracle mint rights.

### 1.3 The ERC-7857 / iNFT layer

This is the "intelligent NFT" story — the token carries private data whose
access transfers with ownership.

```solidity
function transferWithProof(address from, address to, uint256 tokenId,
                           bytes calldata sealedKey, bytes calldata proof) external {
    require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "Not approved");
    require(from == ownerOf(tokenId), "Not owner");
    require(oracle.verifyProof(horses[tokenId].metadataHash, bytes32(0), sealedKey, proof),
            "Invalid proof");
    _transfer(from, to, tokenId);
}
```

The intent: transferring the NFT also re-seals the decryption key for the new
owner, and a TEE-issued proof attests the re-encryption happened correctly.

⚠️ **Know this cold — `MockINFTOracle.verifyProof` returns `true`
unconditionally.** The proof verification is a stub. Anyone can pass arbitrary
bytes. This is the single most likely thing a sharp interviewer finds.

> **How to answer:** "That's mocked. In production it'd verify a TEE
> attestation that the sealed key was correctly re-encrypted to the new owner's
> public key. We modelled the interface and the data flow, not the crypto — for
> a hackathon that was the right scope call, and I know exactly what's missing."

---

## 2. Breeding: the three-step flow

`BreedingMarketplace.sol`, `Ownable + ReentrancyGuard`.

```
list(stallion)  →  purchaseBreedingRight(stallion, seed)  →  breed(stallion, mare, name, salt)
   owner only          buyer pays stud fee                      mare owner mints foal
```

> **Note on the current code:** `purchaseBreedingRight` and `breed` are now thin
> wrappers that call internal implementations with `msg.sender` as the
> `account`. Behaviour of this direct path is unchanged — the snippets below
> describe it accurately. The `*For` variants that let a delegated executor act
> for an owner are covered in §7.

### Step 1 — `list()`

```solidity
require(horseNFT.ownerOf(stallionId) == msg.sender, "Not owner");
require(h.breedingAvailable && !h.injured && !h.retired, "Not available");
```

Creates a `Listing { studFeeADI, maxUses, usedCount, useAllowlist, active }`.

`maxUses` caps a stallion's book — real stud farms limit annual coverings.
`useAllowlist` gates buyers (the institutional/ADI compliance angle).

### Step 2 — `purchaseBreedingRight()`

```solidity
function purchaseBreedingRight(uint256 stallionId, bytes32 seed)
    external nonReentrant onlyKYC
{
    require(list_.active, "Not listed");
    require(list_.usedCount < list_.maxUses, "Max uses");
    if (list_.useAllowlist) require(allowlist[stallionId][msg.sender], "Not allowlisted");
    require(breedingRightExpiry[stallionId][msg.sender] == 0, "Already have right");

    adi.transferFrom(msg.sender, horseNFT.ownerOf(stallionId), list_.studFeeADI);

    breedingRightExpiry[stallionId][msg.sender] = block.timestamp + breedingRightDuration; // 365d
    purchaseSeed[stallionId][msg.sender] = seed;      // ← commitment
}
```

Four things to notice:

1. **The stud fee goes directly to the stallion owner** — the marketplace never
   custodies funds. Requires prior ERC-20 `approve`.
2. **Rights are time-boxed** (365 days default) — mirrors a real breeding
   season contract, not a perpetual license.
3. **`onlyKYC`** — gated on `KYCRegistry.isVerified`, and the modifier no-ops
   if the registry address is zero, so KYC is optional per deployment.
4. **The seed is stored here, at purchase.** This is the commitment. See §3.

### Step 3 — `breed()`

```solidity
require(horseNFT.ownerOf(mareId) == msg.sender, "Not mare owner");
require(hasBreedingRight(stallionId, msg.sender), "No breeding right");
require(sire.breedingAvailable && dam.breedingAvailable
        && !sire.injured && !dam.injured, "Not breedable");
```

Then computes genetics, increments `usedCount` (auto-deactivating the listing
at `maxUses`), mints to `msg.sender`, and emits
`Bred(stallionId, mareId, offspringId)`.

Offspring defaults: `breedingAvailable: false` (a newborn can't breed),
`injured: false`, `retired: false`,
`valuationADI = (sire.valuationADI + dam.valuationADI) / 2`.

> **This is the revert you hit in testing.** An injured mare ⇒ `"Not
> breedable"` ⇒ whole transaction rolls back, no foal, and the breeding right
> survives because reverts undo the `usedCount` increment too.

---

## 3. The genetics engine — `_computeOffspring()`

```solidity
bytes32 h = keccak256(abi.encodePacked(seed, salt));

for (uint256 i = 0; i < 8; i++) {
    uint256 s = sire.traitVector[i];
    uint256 d = dam.traitVector[i];
    uint256 avg = (s * sireWeight + d * damWeight) / 100;     // 55/45

    uint256 mutation = (uint256(h) >> (i * 8)) % mutationRange; // 0..4
    if (mutation == 0 && avg > 0) avg--;
    else if (mutation == 4 && avg < 255) avg++;

    traits[i] = uint8(avg > 255 ? 255 : avg);
}

uint32 pS = (sire.pedigreeScore * sireWeight + dam.pedigreeScore * damWeight) / 100;
pedigreeScore = uint16((pS * decayFactor) / 1000);            // ×0.95
dnaHash = keccak256(abi.encodePacked(sire.dnaHash, dam.dnaHash, traits, salt));
```

### 3.1 The parameters

| Param | Default | Meaning |
|---|---|---|
| `sireWeight` / `damWeight` | 55 / 45 | must sum to 100 (enforced) |
| `mutationRange` | 5 | ≤ 20 (enforced) |
| `decayFactor` | 950 | pedigree × 0.95 per generation |
| `breedingRightDuration` | 365 days | 1–730 days (enforced) |

### 3.2 Why each choice matters

**Why 55/45?** A deliberate, slight sire bias reflecting bloodstock convention
that the stallion contributes marginally more to a foal's commercial profile —
and it makes the outcome non-symmetric, so A×B ≠ B×A.

**How the mutation works.** One shared `keccak256` hash provides all eight
mutations: `(uint256(h) >> (i * 8)) % 5` slices a **different byte of the same
hash per trait**. `mutation == 0` → −1, `mutation == 4` → +1, otherwise no
change. So each trait has a 20% chance down, 20% up, 60% unchanged.

**Pedigree decay (×0.95).** Without it, breeding two elite horses forever would
ratchet pedigree to the 10000 cap and the economy would inflate. Decay means
**elite bloodlines degrade toward the mean unless refreshed by outside
quality** — which is exactly how real bloodstock works, and it creates ongoing
demand for genuinely superior stallions.

**`dnaHash`** chains both parents' hashes plus the resulting traits, so it's a
verifiable lineage fingerprint back to the founders.

### 3.3 The commit–reveal property (say this precisely)

- `seed` is chosen and stored at **purchase** time
- `salt` is supplied at **breed** time
- Offspring = `f(sire, dam, seed, salt)` — pure and deterministic

Therefore:

- **Reproducible** — anyone can recompute the foal from public inputs and
  verify the contract didn't cheat
- **Not shoppable** — the seed is locked before you know the outcome; you can
  grind `salt`, but only within a ±1 mutation band on each trait

> **Expect the follow-up: "isn't `block.timestamp`/salt manipulable?"**
> Correct answer: the salt is user-supplied and the mutation range is only ±1,
> so grinding buys you at most +1 on a few traits — bounded and economically
> uninteresting. The *weights and pedigree decay*, which dominate the outcome,
> are not manipulable at all. If mutations mattered more, you'd need a
> commit-reveal on the salt too, or a VRF.

### 3.4 X-Factor inheritance

```solidity
bool xFactor = dam.xFactorCarrier;   // dam only
```

Real genetics: the enlarged-heart gene is X-linked. A sire passes his single X
only to daughters, so **maternal inheritance is the reliable path**. The
contract simplifies to "inherits from the dam," which is a defensible
approximation. `shared/x-factor.ts` implements the fuller pedigree-tracing
version off-chain, seeded with real historical carriers (Eclipse → Pocahontas
→ Secretariat).

---

## 4. Minting paths

There are exactly **two** ways a horse comes into existence:

| Path | Caller | Used for |
|---|---|---|
| `HorseINFT.mint()` direct | contract `owner()` | seeding founders (`scripts/seed-demo.ts`) |
| `BreedingMarketplace.breed()` | mare owner | all births |

```solidity
require(msg.sender == owner() || msg.sender == breedingMarketplace, "Not minter");
tokenId = _nextTokenId++;
_safeMint(to, tokenId);
```

Token IDs are **sequential from 0**. Founder horses have `sireId == 0 && damId
== 0` — that's how `findOffspring` distinguishes them from real lineage.

`_safeMint` (not `_mint`) → contract recipients must implement
`onERC721Received`, preventing tokens locked in contracts that can't handle
them.

---

## 5. UI → chain → portfolio: the full round trip

### 5.1 The advisor "execute" flow (`app/app/breed/page.tsx`)

1. **EIP-712 signature** of a `BreedingPlan` — user signs in MetaMask
2. **`purchaseBreedingRight`** if not already held (wait for receipt)
3. **`breed(...)`** with a fresh `salt`
4. **Parse `Bred` event** from the receipt to learn the new token ID
5. `queryClient.invalidateQueries()` + a `secretariat-horse-minted` window event
6. Toast → "View Portfolio"

### 5.2 Finding the offspring ID

```typescript
for (const log of receipt.logs) {
  if (log.address?.toLowerCase() !== breedingMarketplaceAddress.toLowerCase()) continue;
  const decoded = decodeEventLog({ abi: [BRED_EVENT], data: log.data, topics: log.topics });
  if (decoded.eventName === "Bred") return Number(decoded.args.offspringId);
}
```

It filters by emitting address (ignores `Transfer` logs from `HorseINFT`),
decodes the `Bred` event, and retries up to 30× at 500 ms while the receipt
propagates.

> **Why not just read `nextTokenId - 1`?** Race condition — another user could
> mint between your tx and your read. The event is the authoritative record of
> *your* transaction.

### 5.3 How the portfolio finds your horses

`app/app/portfolio/page.tsx`:

1. Multicall `getHorseData(0..99)` (`MAX_HORSE_ID_TO_FETCH = 100`)
2. Filter with `isOnChainHorse()` — a horse "exists" if it has a non-empty
   name **or** a non-zero `birthTimestamp` (non-existent tokens return a
   zeroed struct)
3. Multicall `ownerOf()` on the survivors
4. Keep those where `owner.toLowerCase() === address.toLowerCase()`

**The lowercase comparison is load-bearing** — `ownerOf` returns EIP-55
checksummed, wagmi may hand you a differently-cased address, and a naive `===`
silently shows an empty portfolio. This is the one thing the Vitest suite
covers (`app/__tests__/portfolio-mint.test.ts`).

**Known scaling limits:**
- Hard-capped at token ID 100
- `findOffspring` (server-side) is an O(n) linear scan re-reading every token
  on each win cascade

---

## 6. Other horse actions

| Action | Contract | Notes |
|---|---|---|
| Valuation update | `HorseOracle.commitValuation` → `HorseINFT.updateValuation` | includes canonical event hash + 0G root hash |
| Injury | `HorseOracle.reportInjury` | drops valuation by `severityBps`, sets `injured = true` |
| **Recovery** | `HorseOracle.reportRecovery` | clears the flag; *added this session* — injury used to be permanent |
| Retirement | `HorseINFT.setRetired` | oracle or owner |
| Fractionalization | `HorseSyndicateVaultFactory.createVault` | requires `ownerOf == msg.sender`; one vault per horse |
| Catastrophic event | `HorseOracle` risk score 6 | sets injured + triggers Lazarus on the vault |

### The Lazarus Protocol (worth knowing)

Risk score 6 → `_triggerCriticalBiologicalEmergency` → freezes the vault →
60-day creditor escrow (vets/trainers paid **before** shareholders, mirroring
real creditor-priority law) → remainder distributed.

Purpose: stop information-asymmetry dumping — whoever hears catastrophic news
first must not be able to offload shares onto uninformed buyers.

⚠️ **Currently unreachable in the demo**: no seed script creates a vault, so
`vaultForHorse()` returns the zero address and the trigger is a no-op.

---

## 7. Delegated agent execution — the bug and the fix

> **Status: fixed.** This section describes a real design flaw that existed in
> the codebase and how it was repaired. It is one of the strongest things you
> can talk about, because it required reading the system critically rather than
> just implementing a feature.

### 7.1 What was broken

`AgentExecutor` verifies an EIP-712 signed plan and enforces budget on-chain,
then calls the marketplace. But **the marketplace authorized purely on
`msg.sender`** — zero occurrences of `isApprovedForAll`, `getApproved`,
`onBehalfOf`, or `operator` anywhere in it.

When `AgentExecutor` called in, `msg.sender` was the *executor*, so:

| # | Check | What happened |
|---|---|---|
| 1 | `onlyKYC` | verified the executor's address — not KYC'd |
| 2 | `adi.transferFrom(msg.sender, ...)` | pulled the fee from the executor — balance 0 |
| 3 | `require(ownerOf(mareId) == msg.sender)` | **reverted `"Not mare owner"`** |
| 4 | `horseNFT.mint(msg.sender, ...)` | would mint the foal **to the executor** |

Proven empirically — identical call, two senders:

```
from AgentExecutor  → execution reverted: Not mare owner
from the user       → 9   (would mint successfully)
```

And the UI silently routed around it, executing directly as the user. Its own
comments admitted it:

```typescript
// Step 1: EIP-712 signature (compliance record, kept for UX ceremony)
// Step 2: Purchase breeding right if needed (user is msg.sender, not AgentExecutor)
```

So the signed plan was collected and **discarded** — no contract verified it,
and the budget/deadline enforcement never ran.

### 7.2 The fix: operator approval + explicit principal

Two mechanisms were needed, because neither alone is enough:

- **ERC-721 operator approval** supplies *authorization* — reusing a standard
  users already understand instead of inventing an approval registry.
- **An explicit `account` parameter** supplies *identity* — because the
  contract must know who the economic principal is: who pays, who holds the
  right, who receives the foal.

```solidity
function _requireCanActFor(address account) internal view {
    require(
        msg.sender == account || horseNFT.isApprovedForAll(account, msg.sender),
        "Not authorized for account"
    );
}
```

Existing entrypoints became thin wrappers passing `msg.sender`, with new
`*For` variants alongside — so **nothing that already worked changed**:

```solidity
function breed(...) external returns (uint256) {
    return _breed(..., msg.sender);            // unchanged behaviour
}
function breedFor(..., address account) external returns (uint256) {
    _requireCanActFor(account);
    return _breed(..., account);               // delegated
}
```

Inside `_breed`, every `msg.sender` became `account`: the mare-ownership
check, the breeding-right lookup, the seed lookup, and **the mint recipient**.

`AgentExecutor` now calls `purchaseBreedingRightFor` / `breedFor` with
`plan.user`.

### 7.3 A second bug found while wiring the UI

The frontend's EIP-712 domain omitted `verifyingContract`:

```typescript
const domain = { name: "SecretariatBreeding", version: "1", chainId };
```

OpenZeppelin's `_hashTypedDataV4` binds the domain to the verifying contract,
so every signature would have failed `ECDSA.recover` on-chain. It went
unnoticed only because the signature was never submitted anywhere. Fixed by
adding `verifyingContract: addresses.agentExecutor`.

> **Good interview beat:** "The signature was never verified, so a broken
> domain separator produced no symptom. Dead code hides its own bugs."

### 7.4 The new user flow

1. `adi.approve(marketplace)` — one time
2. `horseNFT.setApprovalForAll(agentExecutor, true)` — one time, revocable
3. Sign the EIP-712 `BreedingPlan`
4. `agentExecutor.execute(plan, name, salt, seed, signature)` — the contract
   re-verifies signature, deadline, and stud fee ≤ both caps, then acts

### 7.5 Proof it works

On-chain, live: `execute` returns `success`, the offspring is owned by the
**user**, and the executor's ADI balance is untouched at 0.

Nine tests in `contracts/test/AgentDelegation.t.sol`:

| Test | Proves |
|---|---|
| `agent_executes_plan_and_user_receives_offspring` | foal → user, fee ← user, executor holds nothing |
| `execute_reverts_without_operator_approval` | no approval ⇒ no authority |
| `stranger_cannot_breed_for_someone_else` | delegation isn't an attack surface |
| `stranger_cannot_spend_someone_elses_adi` | can't drain via `*For` |
| `revoking_approval_removes_executor_authority` | revocation works |
| `execute_reverts_when_stud_fee_exceeds_signed_max` | **budget now actually enforced** |
| `execute_reverts_after_deadline` | deadline enforced |
| `execute_reverts_on_signature_from_wrong_signer` | forged signature rejected |
| `direct_breeding_still_works_without_delegation` | backwards compatible |

### 7.6 How to talk about it

> "The agent-safety story was implemented but not on the live path —
> `AgentExecutor` couldn't work, because the marketplace authorized strictly on
> `msg.sender` with no delegation support, so a third-party executor reverted
> with `Not mare owner` and would have minted the foal to itself. I fixed it
> with ERC-721 operator approval for authorization plus an explicit principal
> parameter for identity, kept the old entrypoints as wrappers so nothing
> broke, and added nine tests including the negative cases. The signed budget
> and deadline are now genuinely enforced on-chain rather than decorative."

The security property that now actually holds: **the agent can propose, and
the contract enforces the bounds the user personally signed. A compromised
agent cannot exceed the signed budget, act after the deadline, spend a user's
ADI, or take ownership of the offspring.**

---

## 8. Likely questions, with answers

**"Why compute genetics on-chain? Isn't that expensive?"**
Verifiability. Anyone can recompute a foal from public inputs and confirm the
contract didn't fudge it. Off-chain genetics would require trusting a server.
The cost is bounded — one hash and eight arithmetic ops.

**"How do you prevent someone farming for a perfect foal?"**
The seed is committed at purchase, before the outcome is known. Only the salt
is chosen at breed time, and the mutation band is ±1 per trait — grinding buys
you almost nothing. The dominant terms (parent averages, pedigree decay) aren't
manipulable.

**"Why does pedigree decay?"**
Without it, elite × elite ratchets to the 10000 cap forever and the economy
inflates. Decay pushes bloodlines back toward the mean unless refreshed with
genuine outside quality — which mirrors real bloodstock and sustains demand for
top stallions.

**"Why is trait data on-chain instead of a tokenURI?"**
Because the breeding contract has to *read* it to compute genetics. You can't
do that with an IPFS pointer.

**"What happens if the breed transaction reverts?"**
Everything rolls back atomically — no foal, `usedCount` un-incremented, and the
breeding right survives because it was recorded in an earlier transaction.

**"How does the UI know the new token ID?"**
Decodes the `Bred` event from the receipt, filtered by emitting address. Not
`nextTokenId - 1`, which would race against other users' mints.

**"What's the weakest part of the NFT design?"**
Two remaining: `verifyProof` is a stub (the ERC-7857 proof story is mocked),
and enumeration is capped at token 100 with an O(n) offspring scan. A third —
`AgentExecutor` being unable to act for a user — was found and fixed (§7).

---

## 9. File map

| Path | Role |
|---|---|
| `contracts/src/HorseINFT.sol` | ERC-721 + on-chain horse state + iNFT layer |
| `contracts/src/BreedingMarketplace.sol` | Listings, rights, `breed`, `_computeOffspring` |
| `contracts/src/AgentExecutor.sol` | EIP-712 plan verification (⚠ not on live path) |
| `contracts/src/HorseOracle.sol` | Race/injury/recovery/valuation reporting |
| `contracts/src/KYCRegistry.sol` | KYC + Reg D accreditation |
| `contracts/src/HorseSyndicateVault.sol` | Fractional ownership, Lazarus |
| `contracts/src/MockINFTOracle.sol` | ⚠ `verifyProof` always true |
| `app/app/breed/page.tsx` | Breeding UI, `parseOffspringIdFromReceipt` |
| `app/app/portfolio/page.tsx` | Ownership reconciliation |
| `app/lib/on-chain-horses.ts` | `isOnChainHorse`, `MAX_HORSE_ID_TO_FETCH` |
| `app/__tests__/portfolio-mint.test.ts` | The one frontend test |
| `scripts/seed-demo.ts` | Founder minting |

---

## 10. Contract test coverage

`forge test` — **61 passing, 0 failing** across 7 suites:

| Suite | Tests | Covers |
|---|---|---|
| `SecCompliance` | 9 | Rule 144 lockup, 99-investor cap, KYC gating |
| `LazarusProtocol` | 10 | Freeze, creditor escrow, distribution |
| `MultisigExecution` | 10 | N-of-M human confirmation |
| `RiskScore` | 11 | Risk 1–6, catastrophic trigger, **injury/recovery cycle** |
| `AgentDelegation` | 9 | **Delegated execution, signed-budget enforcement, negative cases** |
| `CuratorRegistry` | 7 | Staked curation, sourcing fees |
| `RevenueArchitecture` | 5 | Fee waterfall, buffer, dividends |

> **Context worth volunteering:** four of these suites were dead until this
> session — they failed in `setUp()` with `"Deployer not set"` because they
> predated the `VaultDeployer` split (done to stay under the 24 KB EIP-170
> bytecode limit) and never wired the deployer to the factory. 17 tests were
> passing and the vault layer — the most compliance-sensitive code — had zero
> coverage. Fixing the fixture took it to 52.
