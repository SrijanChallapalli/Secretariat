# Secretariat — Hackathon Submission

## One-liner pitch

**Secretariat** is a decentralized thoroughbred RWA marketplace with fractional ownership, breeding rights trading, and an on-chain AI Breeding Advisor (ERC-7857-style iNFT) powered by XGBoost—deployable on both 0G Galileo and ADI Chain.

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

---

## Sponsor tracks

- **0G** — Agent model bundle stored on 0G Storage; rootHash in agent iNFT; app retrieves via `GET /og/download/:rootHash`
- **ADI** — Full deployment on ADI AB Testnet; breeding rights purchased with ADI; optional allowlist for institutional compliance
- **AI + Crypto** — Breeding Advisor agent with explainability; EIP-712 signed execution; XGBoost-powered recommendations
- **RWA** — Tokenized horses, fractional ownership vaults, breeding rights as tradeable assets

---

## 5-minute demo script

### Prep
- Deploy contracts on 0G (and optionally ADI). Run `seed:demo`. Start server and app.
- Two MetaMask wallets: **Owner** (deployer, has ADI + horses), **Buyer** (investor).

---

### 1. Network & identity (30 s)
- Open app. Connect **Owner** wallet.
- Header: select **0G Demo** (chainId 16602). Show "Secretariat" and nav: Marketplace, Portfolio, Agent.

---

### 2. Marketplace & horses (1 min)
- **Marketplace:** Browse horses (cards: name, pedigree %, valuation ADI, "Breeding" badge).
- Click **Horse #0** (e.g. Thunder Strike). Show **Traits** (8), **Status** (breeding available, listed), **Stud fee**.
- Optional: show "List breeding rights" / "View vault" if vault created.

---

### 3. Buyer flow: breeding right + breed (1.5 min)
- Switch to **Buyer** wallet. Connect.
- Go to **Horse #0** → "Purchase breeding right". Approve ADI, confirm. Show success.
- **Portfolio** → "Get top 3 breeding picks" or go to **Agent**.
- **Agent:** "Get top 3 breeding picks" → choose Mare = 1 (or your mare ID). Click **Get top 3**.
- Show **Top 3** with score, explainability, risk flags. Say: "Recommend-only by default."
- Optional **Execute with approval:** toggle on, enter offspring name, click **Execute plan** on one pick → sign EIP-712 → confirm tx → offspring minted. Show in Portfolio / Marketplace.

---

### 4. XGBoost model & valuation (1 min)
- **Agent** page: show **Breeding Advisor** and **Horse Valuation Agent** — both powered by Secretariat's XGBoost model.
- Say: "Model is trained on real thoroughbred racing data; predicts prize earnings and offspring potential."
- Go to **Horse #0** → show **Horse Valuation Agent** section with USD value breakdown.

---

### 5. ADI institutional mode (30 s)
- Switch network to **ADI Institutional** (99999). Same UI.
- Say: "Same contracts and flow on ADI Chain for institutional track. Optional allowlist on breeding for compliance."

---

### Closing (30 s)
- "One codebase, two networks; RWA market efficiency; AI guardrails with user-signed execution; XGBoost-powered agents; composable contracts; 0G for model artifacts."
