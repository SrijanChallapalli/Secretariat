# Secretariat — Decentralized Thoroughbred RWA Marketplace

**→ Full step-by-step setup:** see **[SETUP.md](./SETUP.md)** (env, deploy, seed, run app + server, MetaMask).

One codebase, dual deployment: **0G Galileo Testnet** (demo) and **ADI AB Testnet** (institutional). Tokenize horses, fractional ownership, breeding rights market, and an on-chain Breeding Advisor agent (ERC-7857-style iNFT) with 0G Storage model bundle.

## Non-negotiables (MVP)

- **Two wallets:** Owner (mint, list) and Buyer/Investor (buy shares, buy breeding rights, breed).
- **Horse iNFT:** Pedigree links, trait vector, valuation, DNA hash, encryptedURI (0G pointer).
- **Fractional ownership:** Vault per horse; buy shares; claimable revenue.
- **Breeding rights:** List stallion → buyer purchases right with ADI → breed to mint offspring.
- **Agents (Breeding Advisor + S-Agent + Horse Valuation Agent):** Top 3 recommendations + explainability; optional “Execute with approval” (EIP-712 signed plan).
- **Oracle:** Admin/oracle reports race result, injury, news → valuation updates.
- **0G:** Real upload of agent model bundle to 0G Storage; rootHash stored in agent iNFT; app retrieves bundle.

## Repo layout

- **`/contracts`** — Foundry + OpenZeppelin (MockADI, HorseINFT, BreedingMarketplace, HorseSyndicateVault + Factory, HorseOracle, BreedingAdvisorINFT, AgentExecutor, MockINFTOracle).
- **`/app`** — Next.js 14, TypeScript, Tailwind, wagmi, RainbowKit.
- **`/server`** — Node/TS API: `POST /og/upload`, `GET /og/download/:rootHash` (0G Storage), `POST /valuation/calculate` (Horse Valuation Agent).

## Setup

1. **Env**
   - Copy `.env.example` to `.env`.
   - Set `DEPLOYER_PRIVATE_KEY` (testnet wallet with gas).
   - For 0G uploads: set `OG_UPLOADER_PRIVATE_KEY`, `INDEXER_RPC`, `RPC_URL_0G`.

2. **Contracts**
   ```bash
   cd contracts && forge build
   ```

3. **Deploy**
   - 0G: `RPC_0G=https://evmrpc-testnet.0g.ai DEPLOYER_PRIVATE_KEY=0x... npm run deploy:og`
   - ADI: `RPC_ADI=https://rpc.ab.testnet.adifoundation.ai/ DEPLOYER_PRIVATE_KEY=0x... npm run deploy:adi`
   - Write deployed addresses into `.env` as `NEXT_PUBLIC_*` and `ADI_TOKEN`, `HORSE_INFT`, etc.

4. **Seed**
   ```bash
   RPC_URL=https://evmrpc-testnet.0g.ai ADI_TOKEN=0x... HORSE_INFT=0x... BREEDING_MARKETPLACE=0x... AGENT_INFT=0x... npm run seed:demo
   ```

5. **Server (0G upload/download)**
   ```bash
   cd server && npm i && npm run dev
   ```

6. **App**
   ```bash
   cd app && npm i && npm run dev
   ```

## Networks

| Mode        | Chain              | Chain ID | RPC |
|------------|--------------------|----------|-----|
| 0G Demo    | 0G Galileo Testnet | 16602    | https://evmrpc-testnet.0g.ai |
| ADI Institutional | ADI AB Testnet | 99999 | https://rpc.ab.testnet.adifoundation.ai/ |

MetaMask: add both networks; switch via RainbowKit/header (“0G Demo” / “ADI Institutional”).

## Contracts (short)

- **MockADI** — ERC20 “ADI Token (Demo)”; mintable by deployer.
- **HorseINFT** — ERC-7857-style: mint(to, encryptedURI, metadataHash, horseData), authorizeUsage, transferWithProof (MockINFTOracle).
- **BreedingMarketplace** — list(stallionId, studFee, maxUses, useAllowlist); purchaseBreedingRight(stallionId, seed); breed(stallionId, mareId, offspringName, salt). Deterministic genetics (seed/salt).
- **HorseSyndicateVault** — Per-horse ERC20 shares; buyShares; depositRevenue; claim pro-rata.
- **HorseOracle** — reportRaceResult, reportInjury, reportNews (ORACLE_ROLE); updates HorseINFT valuation.
- **BreedingAdvisorINFT** — Agent iNFT with profile (name, version, specialization, modelBundleRootHash). Token 0: Breeding Advisor; Token 1: S-Agent (pedigree synergy + complement). Horse Valuation Agent is off-chain (see `app/lib/horse-valuation-agent.ts`, `server/bundle/valuation-agent/`); when oracle reports race/injury/news, call `POST /valuation/calculate` for agent-suggested USD value.
- **AgentExecutor** — EIP-712 BreedingPlan; execute(plan, offspringName, salt, purchaseSeed, signature) enforces budget/rights and calls marketplace.

## 0G Storage

- **Upload:** App or server builds a model bundle (dataset.json, weights.json, model_card.md, evaluation.json, agent_code.ts or s-agent_code.ts or valuation_agent_code.ts) ≥10MB (pad if needed), POST to `/og/upload` → returns `rootHash`, `txHash`. Store `rootHash` in agent iNFT (mint or updateModelBundle). Bundles: `server/bundle/` (Breeding Advisor), `server/bundle/s-agent/` (S-Agent), `server/bundle/valuation-agent/` (Horse Valuation Agent).
- **Download:** GET `/og/download/:rootHash` streams file. “Refresh from 0G” in UI uses this to show bundle version/contents.

## Agent guardrails

- **Recommend-only (default):** UI runs scoring locally; shows Top 3 + explainability; no on-chain execution. S-Agent uses `/breed?agent=s-agent`; Breeding Advisor uses `/breed?advisor=1`.
- **Execute with approval:** User signs EIP-712 BreedingPlan (budget, maxStudFee, mare, chosenStallion, deadline, traitFloor). AgentExecutor checks signature and constraints, then purchaseBreedingRight (if needed) + breed.

## 5-minute judge demo script

1. **Network:** Switch to “0G Demo” (16602).
2. **Owner wallet:** Show Portfolio → ADI balance; Marketplace → horses 0, 1, 2 (minted by seed). Open Horse #0 → “List breeding rights” (already listed); show stud fee.
3. **Buyer wallet:** Connect second wallet. Marketplace → Horse #0 → “Purchase breeding right” (approve ADI, then purchase). Portfolio → “Get top 3 breeding picks” → Agent page → “Get top 3 breeding picks” → see recommendations; optionally enable “Execute with approval”, sign plan, execute → offspring minted.
4. **0G:** Agent page → show agent iNFT and model bundle rootHash; “Refresh from 0G” / Download bundle by rootHash (server must be running).
5. **ADI:** Switch network to “ADI Institutional” (99999). Same UI; same flow (use addresses deployed on ADI). Optional: show allowlist on breeding list for institutional mode.

## Scripts

- `check` — Build all workspaces, then `cd contracts && forge build && forge fmt --check .` (quality gate).
- `deploy:og` — Deploy to 0G Galileo.
- `deploy:adi` — Deploy to ADI AB Testnet.
- `seed:demo` — Mint ADI, mint horses, list stallions, mint Breeding Advisor iNFT (token 0) + S-Agent iNFT (token 1) (set env addresses).
- `demo:reset` — Placeholder (redeploy for clean state).

## License

MIT.
