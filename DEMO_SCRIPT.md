# Secretariat — 5-minute judge demo

## Prep
- Deploy contracts on 0G (and optionally ADI). Run `seed:demo`. Start server and app.
- Two MetaMask wallets: **Owner** (deployer, has ADI + horses), **Buyer** (investor).

---

## 1. Network & identity (30 s)
- Open app. Connect **Owner** wallet.
- Header: select **0G Demo** (chainId 16602). Show “Secretariat” and nav: Marketplace, Portfolio, Agent.

---

## 2. Marketplace & horses (1 min)
- **Marketplace:** Browse horses (cards: name, pedigree %, valuation ADI, “Breeding” badge).
- Click **Horse #0** (e.g. Thunder Strike). Show **Traits** (8), **Status** (breeding available, listed), **Stud fee**.
- Optional: show “List breeding rights” / “View vault” if vault created.

---

## 3. Buyer flow: breeding right + breed (1.5 min)
- Switch to **Buyer** wallet. Connect.
- Go to **Horse #0** → “Purchase breeding right”. Approve ADI, confirm. Show success.
- **Portfolio** → “Get top 3 breeding picks” or go to **Agent**.
- **Agent:** “Get top 3 breeding picks” → choose Mare = 1 (or your mare ID). Click **Get top 3**.
- Show **Top 3** with score, explainability, risk flags. Say: “Recommend-only by default.”
- Optional **Execute with approval:** toggle on, enter offspring name, click **Execute plan** on one pick → sign EIP-712 → confirm tx → offspring minted. Show in Portfolio / Marketplace.

---

## 4. 0G Storage & agent iNFT (1 min)
- **Agent** page: show **Agent identity** (name, version, model bundle rootHash).
- Say: “Model bundle is uploaded to 0G Storage; rootHash is stored in the agent iNFT.”
- “Refresh from 0G”: paste rootHash (or use one from a previous upload), click **Download bundle** → file downloads from server (server calls 0G indexer.download). “So the app really retrieves the bundle from 0G.”

---

## 5. ADI institutional mode (30 s)
- Switch network to **ADI Institutional** (99999). Same UI.
- Say: “Same contracts and flow on ADI Chain for institutional track. Optional allowlist on breeding for compliance.”

---

## Closing (30 s)
- “One codebase, two networks; RWA market efficiency; AI guardrails with user-signed execution; on-chain agent ownership; composable contracts; 0G for model artifacts.”
