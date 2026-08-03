# Secretariat — Presentation Playbook

Everything verified against the code as of 2026-08-02.
Companion to `STUDY-GUIDE-ML.md` and `STUDY-GUIDE-NFT-BREEDING.md`.

---

## 0. The frame you should hold in your head

Most hackathon projects are **a demo with a story attached**. Yours is
unusual in that the depth is real in specific, checkable places — on-chain
genetics, securities logic in the transfer hook, 78 passing contract tests —
and thin in others. Your entire credibility strategy is:

> **Be the person who knows exactly which parts are real.**

Judges and engineers have seen a hundred projects that overclaim. Almost none
have seen one where the builder says "that part's mocked, here's precisely what
production would need." That contrast is your biggest asset, and it costs you
nothing because the strong parts are genuinely strong.

**Never** say "fully decentralized AI," "production-ready," or "the AI manages
your portfolio." Every one of those is falsifiable in about two questions.

---

## 1. The pitch

### One sentence
> Secretariat tokenizes racehorses as NFTs with on-chain genetics, wraps
> fractional ownership in real securities compliance, and adds an AI breeding
> advisor that can propose but never unilaterally act.

### The three things that make it distinctive

Lead with these, in this order. They are ranked by *how hard they'd be to
fake*, which is what makes them credible:

1. **Genetics are computed on-chain and are deterministically reproducible.**
   Anyone can recompute a foal from public inputs and verify the contract
   didn't fudge it — with a commit-reveal seed so you can't shop for outcomes.
2. **Securities compliance lives in the ERC-20 transfer hook, not the UI.**
   Rule 144 lockup, the 99-investor cap, KYC + accreditation — enforced at the
   token level, so a different frontend cannot route around them.
3. **The AI is architecturally incapable of acting alone.** It holds no key
   and no wallet. It proposes; the user signs a bounded plan; the contract
   re-verifies and enforces the bounds.

### The 30-second version

> "It's a marketplace for fractional racehorse ownership. Three things are
> technically interesting. Breeding genetics run on-chain deterministically, so
> offspring are verifiable rather than trust-me. The fractional ownership
> enforces real securities rules — Rule 144 lockups, the 99-investor cap — in
> the token's transfer hook rather than the interface. And there's an AI
> advisor that can propose breeding plans but structurally cannot execute one:
> it has no key, and the contract re-checks everything the user signed. Happy
> to go deep on any of those."

That last line matters — it hands them the steering wheel and signals you have
depth in all three.

---

## 2. Architecture

### The shape

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 16 app  ·  wagmi + RainbowKit + viem           │
│  reads chain directly, calls server only for AI         │
└──────────────┬──────────────────────┬───────────────────┘
               │ contract calls        │ HTTP
               ▼                       ▼
┌──────────────────────────┐  ┌────────────────────────────┐
│  Chain (Anvil / 0G / ADI)│  │  Express server            │
│  17 Solidity contracts   │◄─┤  oracle pipeline           │
│  ALL authoritative state │  │  XGBoost (pure TS)         │
└──────────────────────────┘  │  valuation + biometrics    │
               ▲               └─────────┬──────────────────┘
               │                         │ optional
               │                         ▼
               │               ┌────────────────────┐
               └───────────────┤ 0G Storage/Compute │
                 root hashes   └────────────────────┘

  shared/  ── zero-dependency domain math, imported by BOTH
```

### The one design principle to name

> **The chain is the source of truth; the server is a licensed commentator.**

The server never holds authoritative state. It reads horse data, computes,
writes results back *through the oracle contract*, then **re-reads the chain to
verify its own write landed**. Kill the server and ownership, valuations, and
compliance rules remain intact and enforceable.

Say that sentence. It demonstrates you thought about trust boundaries rather
than just wiring services together.

### Why `shared/` exists

Domain math — genetics, dosage index, injury catalog, age conventions — lives
in a package with **zero runtime dependencies**, so the browser and the Node
server run byte-identical functions. No "the UI says 8.2 but the server says
8.4" class of bug.

---

## 3. Technology inventory — and why each

Be ready to justify every choice. "It's what I knew" is an acceptable answer
*once*; have a real reason for the big ones.

| Layer | Tech | Why this, and the tradeoff |
|---|---|---|
| Contracts | Solidity 0.8.24, Foundry | Foundry for fast Solidity-native tests. `via_ir`, optimizer runs = **20** — tuned low specifically to stay under the 24 KB EIP-170 limit |
| Frontend | Next.js 16, React 19 | App Router. Pinned to **webpack**, not Turbopack — Turbopack breaks react-three-fiber |
| Chain access | wagmi + viem, multicall | Multicall batches ~100 horse reads into one RPC round-trip |
| Wallet | RainbowKit | Swapped `getDefaultConfig` for explicit connectors (see §6) |
| Server | Express + tsx | No build step in dev; `viem` for reads, `ethers` only because the 0G SDK requires it |
| ML training | Python, XGBoost 3.3 | Offline only |
| ML inference | **Hand-written TypeScript tree-walker** | No Python runtime, no native bindings, no ONNX — runs anywhere Node runs, sub-ms. Cost: locked to tree models in that export format |
| LLM | qwen-2.5-7b via 0G Compute | OpenAI-compatible proxy. Purely additive — explains scores, never produces them |
| Storage | 0G Storage | Model bundle root hash committed on-chain |
| 3D | react-three-fiber | Biometric viewer, with a procedural fallback mesh if the model fails to load |

### The tech choice worth bragging about

**The pure-TypeScript XGBoost inference.** ~230 lines that read XGBoost's
native JSON and manually walk 500 trees:

```typescript
while (tree.leftChildren[nodeIdx] !== -1) {          // -1 == leaf
  const v = features[tree.splitIndices[nodeIdx]] ?? 0;
  nodeIdx = v < tree.splitConditions[nodeIdx]
    ? tree.leftChildren[nodeIdx] : tree.rightChildren[nodeIdx];
}
return tree.baseWeights[nodeIdx];
// prediction = baseScore + Σ(500 leaves), then expm1()
```

Python trains, TypeScript serves. One runtime to deploy instead of two.

---

## 4. Strengths — ranked, with the specific detail that proves each

Don't just claim these; each has a concrete detail that shows it's real.

### 1. Deterministic on-chain genetics with commit-reveal
Offspring traits = 55/45 sire/dam weighted average ± a mutation from
`keccak256(seed, salt)`. The **seed is committed at purchase**, before the
outcome is known; only the salt is chosen at breed time, and the mutation band
is ±1 per trait. So: reproducible by anyone, and not shoppable.

**Pedigree decays ×0.95 per generation** — otherwise elite × elite ratchets to
the cap and the economy inflates. That's a designed economic pressure, not an
accident.

### 2. Securities compliance in the transfer hook
`HorseSyndicateVault._update()` enforces the 90-day Rule 144 lockup, the
99-investor cap (Investment Company Act §3(c)(1)), and KYC + accreditation
**on the recipient** of every transfer. Accreditation expires after 365 days,
matching SEC re-certification guidance.

### 3. The Lazarus Protocol
Biometric risk score 6 auto-freezes the vault. Purpose: **stop
information-asymmetry dumping** — whoever hears catastrophic news first must
not offload shares onto uninformed buyers. Insurance then enters a 60-day
creditor escrow, paying vets and trainers *before* shareholders, mirroring real
creditor-priority law.

### 4. Layered, non-overlapping agent guardrails
- `AgentExecutor` — bounds *which actions* are valid (signed plan, deadline, budget)
- `AgentWallet` — ERC-4337 rolling daily/weekly spend caps, bounds *how much value moves*
- `MultisigExecution` — governance votes still need human N-of-M confirmation

Neither subsumes the other. That's defense in depth, not one control wearing
three hats.

### 5. Real domain modeling, applied consistently
Dosage Index (genuine handicapping math), X-Factor (X-chromosome inheritance of
the enlarged-heart gene), Palmgren–Miner cumulative bone fatigue (mechanical
engineering theory applied to bone loading), Jockey Club age conventions,
protected champion names.

The tell that it's a real model, not decoration: **the "gelding disconnect"**
— castrated horses have zero breeding value — appears independently in the
valuation agent, the cascade logic, and the vault economics.

### 6. Graceful degradation everywhere
No model file → formula-only valuation. No LLM credentials → scores without
prose. Server down → client-side scoring, **badged in the UI** so you're never
misled about which ran.

### 7. 78 passing contract tests
Including negative cases: a stranger can't breed for you, can't spend your ADI,
revoking approval removes authority, siblings can't breed.

---

## 5. Tradeoffs — have an answer ready for each

Judges probe tradeoffs to see whether you *chose* or *defaulted*.

| Decision | Gained | Paid |
|---|---|---|
| Genetics on-chain | Verifiability — anyone can recompute and check | Gas; genetics must stay simple enough for the EVM |
| Trait state on-chain (not tokenURI) | The breeding contract can *read* traits — impossible with an IPFS pointer | Higher storage cost, migrations need a struct change |
| Pure-TS inference | One runtime, sub-ms, deploys anywhere | Tree models only, in one export format |
| ML as a **bounded multiplier** (0.6–2.5×) on a formula | Model can't produce absurd valuations; always a deterministic floor | Model can't express strong conviction either |
| Rules duplicated client + contract | Rejected pairings are greyed-out buttons, not failed transactions | Drift risk — mitigated by one shared module |
| Factory split into two contracts | Vault fits under EIP-170 | Extra indirection; deploy must wire both |
| Block only *close* inbreeding | Matches real practice — linebreeding is encouraged; Secretariat was 2×3 to Nasrullah | Doesn't model inbreeding coefficients properly |
| Operator approval for agent delegation | Reuses an ERC-721 standard users know; revocable in one tx | Grants blanket authority over all your horses, not per-horse |

---

## 6. Limitations — volunteer these, don't get caught

**The rule: name the limitation before they find it, and immediately state
what production would need.** That converts a weakness into evidence of
judgment.

### The four you should proactively raise

**1. ERC-7857 proof verification is a stub.**
`MockINFTOracle.verifyProof` returns `true` unconditionally.
> "In production that verifies a TEE attestation that the sealed key was
> correctly re-encrypted to the new owner. We modelled the interface and the
> data flow, not the crypto — right scope call for a hackathon, and I know
> exactly what's missing."

**2. The ML model is fed constants in production.**
This is the sharpest one, and the most impressive to volunteer. An audit of
feature importance vs. what the runtime actually supplies:

| Feature | Model rank | Value at inference |
|---|---|---|
| `avg_norm_position` | #1 | `0.4` hardcoded |
| `avg_class` | #2 | derived from pedigree |
| `avg_field_size` | #3 | `8` hardcoded |

> "The model trained on horses with real race histories; on-chain horses only
> have traits and a pedigree score, so three of its top five features are
> constants in production. The fix is to retrain on features that actually
> exist at inference — the R² would drop a lot and be worth far more."

**3. R² 0.969 is inflated.** Three ways: target encoding fit before CV
(+0.021), a resubstitution score reported next to it, and mainly **target
reconstruction** — prize money is `Σ(purse × placing share)`, and the features
contain class, field size, and finishing position. It's arithmetic, not
prophecy. Also trained only on the 44% who earned anything.

**4. The vault/Lazarus flow isn't reachable in the demo.** No seed script
creates a vault, so `vaultForHorse()` returns zero. The logic is real and
tested — 10 Lazarus tests pass — but you can't click to it.

### Smaller ones, if asked
- Enumeration capped at token ID 100; `findOffspring` is an O(n) scan
- Demo enrichment data on chain 31337 is fabricated (gated, but looks live)
- `prediction-log.ts` implements accuracy tracking with **no callers**
- Frontend test coverage is one Vitest file
- Agent scoring is sequential, one HTTP round-trip per mare

---

## 7. The demo — beat by beat

**Run production mode.** Dev-mode first-page compiles take 30–70 s on this
machine; production serves in ~15 ms.

```bash
npm run build --workspace=app
```
```bash
npx next start -p 3000 --prefix app
```

Pre-flight: Anvil up, contracts deployed, seed run, server up, MetaMask on
**Anvil Local / chain 31337** with the deployer account imported.

### Beat 1 — Market (30 s)
Marketplace. Horses with traits, pedigree, live valuations.
> "Everything here is on-chain state, not a database. Valuations are moving
> because there's an oracle pipeline committing updates as race events arrive."

### Beat 2 — The breeding rules (60 s) ← *your strongest visual*
Breeding Lab. Select a mare.
> "Notice which stallions are offered. Sex is enforced — a mare can't sire.
> And this horse's father isn't in the list."

Open **"pairings ruled out."**
> "The agent shows its work. That's blocked because he's her father — the
> contract enforces it with an ancestry walk, and the UI mirrors it so you get
> a disabled option instead of a failed transaction."

This lands because it's visible, obviously correct, and clearly deliberate.

### Beat 3 — The agent (90 s) ← *your best story*
Agent tab → **Propose Breeding**.
> "This evaluates every mare I own against every stallion legally able to cover
> her, scores each with XGBoost — it predicts what the unborn foal would earn,
> using the same 55/45 genetics the contract will actually apply — and ranks
> the whole cross-product."

Then the point:
> "Approving signs an EIP-712 plan with a budget cap and deadline. The agent
> holds no key. The contract re-verifies my signature, re-reads the live stud
> fee, and rejects anything over the budget I signed. Worst case, a compromised
> agent proposes something I don't sign."

### Beat 4 — Breed it (45 s)
Execute. Show the foal in Portfolio.
> "Genetics computed on-chain — 55/45 plus a mutation from a hash of a seed
> committed at purchase. Anyone can recompute this foal and verify it. And the
> sex was a 50/50 draw from that same hash."

### Beat 5 — Close (20 s)
> "One codebase, deployable to 0G and ADI. 78 contract tests. And I can tell
> you exactly which parts are production-grade and which are scoped for a
> hackathon — the ERC-7857 proof is mocked, and the ML is fed some synthetic
> features because on-chain horses don't have race histories yet."

**Ending on a limitation is deliberate.** It's the most memorable thing you can
do, and it makes everything you claimed before it more believable.

### If something breaks
- **Wallet won't connect** → use "Browser Wallet"; there's no WalletConnect project ID
- **Breeding reverts** → a parent is injured or unregistered; pick another mare, or explain the rule (it's a feature)
- **No proposal** → no eligible mare; register a foal for breeding first
- **Page hangs** → you're in dev mode, not production
- **Valuations frozen** → auto-simulator injuries are disabled; that's intentional

---

## 8. Q&A — likely questions with answers

**"How much of this is real vs. mocked?"**
> Contracts, genetics, compliance logic and the oracle pipeline are real and
> tested. Mocked: ERC-7857 proof verification, the ADI token, and the race data
> — a simulator generates events because there's no live feed. Horse race
> histories in the UI are seeded demo data behind a flag.

**"Why on-chain genetics? Isn't that expensive?"**
> Verifiability. Anyone can recompute a foal from public inputs and confirm the
> contract didn't cheat. Off-chain means trusting a server. The cost is bounded —
> one hash and eight arithmetic operations.

**"Could someone farm for a perfect foal?"**
> No. The seed is committed at purchase, before the outcome is known. Only the
> salt is chosen at breed time and the mutation band is ±1 per trait, so
> grinding buys almost nothing. The dominant terms — parent averages and
> pedigree decay — aren't manipulable.

**"Is the AI on-chain?"**
> The model's identity and integrity hash are — the iNFT holds a 0G Storage
> root hash of the model bundle. Inference is off-chain, because running 500
> gradient-boosted trees in the EVM would be economically absurd.

**"What stops the AI from doing something harmful?"**
> It has no key. It can only produce a proposal. Execution requires a
> user-signed EIP-712 plan, and the contract re-verifies signature, deadline
> and budget against the *live* stud fee before spending anything.

**"What was the hardest bug?"**
> The ML calibration one. Both consumers converted the model's GBP prediction
> using a hardcoded "£2,500 median" that was actually the 78th percentile — the
> real median is £0, because most racehorses never earn anything. Combined with
> a linear ratio capped at 10×, every horse above £25k collapsed to the same
> multiplier, so the model ranked four horses correctly across a 3× spread and
> the blend flattened them. Nothing crashed; I found it by logging intermediate
> values across a quality sweep. First fix — percentiles — was also wrong,
> because with a zero median any positive prediction lands above p50. The real
> fix was log-scale interpolation between anchors taken from the actual
> distribution. And the same magic number had been copy-pasted into a second
> call site, so fixing one didn't fix the other.

**"What would you do next?"**
> Three things: retrain the model on features that exist at inference; seed a
> vault so the compliance and Lazarus flows are demoable; and close the
> retraining loop — the event indexer is already accumulating real training
> data, but nothing consumes it yet.

**"What are you least happy with?"**
> That the model's best features are constants in production. It makes the
> valuations less meaningful than they look. It's the first thing I'd fix.

---

## 9. Rehearsal checklist

- [ ] Say the pitch out loud 3× until the three distinctive points are automatic
- [ ] Practise **"the chain is the source of truth, the server is a licensed commentator"**
- [ ] Rehearse the ruled-out-pairings reveal — it's your best visual
- [ ] Be able to name **one honest limitation in under 5 seconds**
- [ ] Know which parts are mocked *cold* — this is your credibility
- [ ] Run the production build before you present
- [ ] Confirm MetaMask is on Anvil Local with the deployer account
- [ ] Have the two study guides open on your phone

### The mindset

You are not defending a product. You are **walking an engineer through a system
you understand well enough to critique.** Every limitation you volunteer makes
every strength more credible.

If you don't know something: *"I don't know — I'd have to check how that
behaves."* That answer costs you nothing and buys enormous trust. Bluffing to
an engineer costs you everything.
