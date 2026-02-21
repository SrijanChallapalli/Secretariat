# Secretariat — Hackathon Submission

## One-liner pitch

**Secretariat** is a decentralized thoroughbred RWA marketplace with fractional ownership, breeding rights trading, and an on-chain AI Breeding Advisor (ERC-7857-style iNFT) — powered by XGBoost + 0G Compute inference, deployable on both 0G Galileo and ADI Chain.

---

## Live deployment

> **URL:** _TBD — pre-deploy to 0G testnet for judges (see below)._

### Pre-deploy for judges (one-command flow)

For hackathon demos, pre-deploy to 0G testnet so judges can use the app immediately:

```bash
# 1. Deploy contracts to 0G
RPC_0G=https://evmrpc-testnet.0g.ai DEPLOYER_PRIVATE_KEY=0x... npm run deploy:og

# 2. Write addresses to .env
npm run env:from-broadcast

# 3. Seed demo data (horses, breeding listings, agent iNFT)
RPC_URL=https://evmrpc-testnet.0g.ai npm run seed:demo
```

Then run server (`cd server && npm run dev`) and app (`cd app && npm run dev`). Full details in [SETUP.md](./SETUP.md).

### Local testing (no testnet needed)

```bash
npm run test:local
```

This starts Anvil, deploys, seeds, and runs everything locally. All features work including mock 0G storage.

---

## Sponsor tracks

### 0G — Chain + Storage + Compute

| 0G Component | How Secretariat Uses It |
|---|---|
| **0G Chain** | All 12+ smart contracts deployed to 0G Galileo Testnet (chain 16602). Horse iNFTs, breeding marketplace, syndicate vaults, agent executor, risk config. |
| **0G Storage** | Agent model bundles (XGBoost weights, dataset, model card, agent code) uploaded via `@0glabs/0g-ts-sdk`. Root hash stored in agent iNFT on-chain. Download and verify via `GET /og/download/:rootHash`. |
| **0G Compute** | Breeding recommendation explanations generated via `qwen-2.5-7b-instruct` on 0G Compute Network (testnet). Server calls OpenAI-compatible `/v1/proxy/chat/completions` endpoint. LLM produces structured natural-language "why" for each of top 3 picks. |

### ADI Foundation — Institutional RWA

Secretariat deploys the same contracts to ADI AB Testnet (chain 99999) for institutional thoroughbred syndication. ADI-specific compliance features:

| Feature | Contract | Purpose |
|---|---|---|
| **KYC Registry** | `KYCRegistry.sol` | On-chain identity gate. `verify()`, `verifyBatch()`, `revoke()`. Optional (disabled when set to zero address). |
| **Allowlist Breeding** | `BreedingMarketplace.sol` | Stallion owners restrict breeding right purchases to an allowlist per listing. |
| **Governance Vaults** | `HorseSyndicateVault.sol` | ERC20Votes shares. `SyndicateGovernor.sol` enables on-chain proposals for syndicate decisions. |
| **Invoice System** | `HorseSyndicateVault.sol` | Registered service providers (trainer, vet). Invoice submit/approve/pay. Agent operator can approve invoices. |
| **Audit Receipts** | `HorseSyndicateVault.sol` | Immutable dividend Merkle root receipts for regulatory auditability. |
| **ADI Token** | `MockADI.sol` | ERC20 used for all payments (stud fees, share purchases, revenue distribution). |

**L3 Composability**: Secretariat's contracts are designed to run on ADI's modular L3 architecture. Jurisdictions can deploy dedicated L3s (e.g. UK Jockey Club L3, US Racing Commission L3) with custom KYC rules and allowlists, while sharing liquidity and horse ownership across L3s via ADI Chain L2.

### AI + DeFi (DeFAI)

- **Breeding Advisor** — XGBoost-enhanced scoring (25% ML weight) with trait compatibility, pedigree synergy, complementary fill, cost, and form factors.
- **Horse Valuation Agent** — Formula-based valuation with racing value, breeding value, age/health modifiers, and event adjustments.
- **0G Compute Explanations** — Natural-language AI "why" for each recommendation via 0G Compute Network.
- **User Safety** — EIP-712 signed breeding plans; budget/deadline/trait-floor enforcement; recommend-only by default; simulation before execution.

### On-Chain Agent (iNFT)

- **BreedingAdvisorINFT** — ERC-7857-style iNFT with on-chain profile (name, version, specialization, modelBundleRootHash).
- **Agent Execution** — `AgentExecutor.sol` accepts user-signed EIP-712 `BreedingPlan` structs. Enforces budget, max stud fee, deadline, and trait floor.
- **Model Bundle on 0G Storage** — Dataset, weights, model card, evaluation, and agent code stored decentralized. Root hash in iNFT contract.
- **Composability** — Any contract can call `AgentExecutor.execute(plan, ...)` with a valid user signature. Vault shares are standard ERC20Votes. Breeding rights are composable on-chain primitives.

---

## AI Models & Tasks

| Model | Task | Why | Where It Runs |
|---|---|---|---|
| **XGBoost** (custom, 150+ trees) | Breeding compatibility scoring: predicts offspring prize earnings from sire/dam trait vectors, pedigree, race history | Structured tabular data — XGBoost excels at learning non-linear feature interactions in racing statistics | Express server (`server/src/xgboost-predictor.ts`) |
| **qwen-2.5-7b-instruct** (0G Compute) | Generate natural-language explanations for breeding recommendations | LLM provides human-readable "why" for each pick, improving explainability and user trust | 0G Compute Network via OpenAI-compatible API |
| **Valuation Agent** (formula + events) | Horse valuation from racing earnings, breeding potential, age/health/market adjustments | Deterministic formula ensures reproducible, auditable valuations with event-driven updates | Express server (`server/src/valuation-engine.ts`) |

**Training data**: XGBoost model trained on historical thoroughbred racing data. Features: race count, win/place count, position statistics, distance/surface preferences, official ratings, sire/damsire lineage.

---

## Composability

Secretariat is designed for other builders to integrate:

- **AgentExecutor** accepts any EIP-712 signed `BreedingPlan` — third-party UIs or agents can compose breeding actions.
- **HorseSyndicateVault** uses standard ERC20Votes — compatible with any governance framework (Tally, Snapshot, custom).
- **BreedingMarketplace** breeding rights are on-chain with expiry timestamps — composable with secondary markets or derivatives.
- **HorseOracle** accepts external event reports (race results, injuries, news) — pluggable with real-world data feeds.
- **0G Storage** root hashes are publicly verifiable — any client can download and verify the agent model bundle.

---

## 5-minute demo script

### Prep
- Deploy contracts on 0G (and optionally ADI). Run `seed:demo`. Start server and app.
- Two MetaMask wallets: **Owner** (deployer, has ADI + horses), **Buyer** (investor).

---

### 1. Network & identity (30 s)
- Open app. Connect **Owner** wallet.
- Header: select **0G Demo** (chainId 16602). Show "Secretariat" and nav: Marketplace, Portfolio, Agent, Risk.

---

### 2. Marketplace & horses (1 min)
- **Marketplace:** Browse horses (cards: name, pedigree %, valuation ADI, "Breeding" badge).
- Click **Horse #0** (e.g. Thunder Strike). Show **Traits** (8-vector), **Status** (breeding available, listed), **Stud fee**.
- Show "View vault" if vault created. Show biometric scan section.

---

### 3. Buyer flow: breeding right + breed (1.5 min)
- Switch to **Buyer** wallet. Connect.
- Go to **Horse #0** → "Purchase breeding right". Approve ADI, confirm. Show success.
- Navigate to **Breeding Lab**. Select mare. Click **Get top 3 picks**.
- Show **Top 3** with score breakdown, simulated offspring traits, and AI explanations (via 0G Compute).
- Say: "Recommend-only by default. Offspring trait simulation shown before any execution."
- **Execute with approval:** Enter offspring name, click Execute → sign EIP-712 → confirm tx → offspring minted.

---

### 4. Agent & 0G (1 min)
- **Agent** page: show **Breeding Advisor iNFT** — name, version, specialization pulled from on-chain contract.
- Show **Model Bundle**: root hash, size, files — stored on 0G Storage.
- Click **Refresh** — fetches live metadata from chain and verifies bundle on 0G.
- Click **Download** — downloads model bundle from 0G Storage via server.
- Say: "Model bundle integrity verified by root hash. Agent intelligence is user-owned."

---

### 5. Risk board (30 s)
- **Risk** page: Select horse, show risk parameters (min valuation, max drawdown, health threshold).
- Show stop-loss armed, auto-retire armed. Say: "AI agent operates within mathematically rigid guardrails."

---

### 6. ADI institutional mode (30 s)
- Switch network to **ADI Institutional** (99999). Same UI, same flow.
- Say: "Same contracts on ADI Chain. KYC registry gates share purchases. Allowlist controls breeding access. ERC20Votes governance on vault shares. Invoice system for service providers. Merkle root dividend receipts for regulatory audit."

---

### Closing (30 s)
- "One codebase, dual deployment. AI-powered DeFi with user safety. XGBoost + 0G Compute inference. On-chain agent iNFT with 0G Storage model bundles. Institutional compliance via ADI. Fully composable contracts."

---

## Reproducible setup

See [SETUP.md](./SETUP.md) for full step-by-step. Key environment variables:

| Variable | Required | Description |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | Yes | Testnet wallet with gas |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | Yes | 32-char ID from cloud.walletconnect.com |
| `OG_UPLOADER_PRIVATE_KEY` | For 0G uploads | 0G Storage uploader key |
| `OG_COMPUTE_PROVIDER_URL` | For AI explanations | 0G Compute provider service URL |
| `OG_COMPUTE_SECRET` | For AI explanations | 0G Compute `app-sk-...` bearer token |
| `OG_COMPUTE_MODEL` | Optional | Defaults to `qwen-2.5-7b-instruct` |
