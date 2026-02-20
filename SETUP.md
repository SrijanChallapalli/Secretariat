# Secretariat – Full setup (fully functional)

Follow these steps in order. Use the same `.env` at repo root (and `app/.env` is synced after deploy).

**Hackathon judges:** For a quick demo, pre-deploy to 0G testnet and run `seed:demo` so the app is ready when judges connect. See [HACKATHON.md](./HACKATHON.md) for the one-command deploy + seed flow.

---

## 1. Environment

- Copy `.env.example` to `.env` in the **repo root** (already done if you ran setup).
- Set in `.env`:
  - **`DEPLOYER_PRIVATE_KEY`** – testnet wallet private key (with gas). **Never commit.**
  - **`NEXT_PUBLIC_WALLETCONNECT_ID`** – 32-character project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com).
  - **`NEXT_PUBLIC_APP_URL`** = `http://localhost:3000`
  - **`NEXT_PUBLIC_SERVER_URL`** = `http://localhost:4000`
- For 0G uploads (server): set **`OG_UPLOADER_PRIVATE_KEY`**. Optional: `INDEXER_RPC`, `RPC_URL_0G` (defaults exist).

---

## 2. Contracts

```bash
cd contracts && forge build
```

Deploy to **0G Galileo**:

```bash
# From repo root
export RPC_0G=https://evmrpc-testnet.0g.ai
export DEPLOYER_PRIVATE_KEY=0x...   # your testnet wallet
npm run deploy:og
```

Optional – deploy to **ADI**:

```bash
export RPC_ADI=https://rpc.ab.testnet.adifoundation.ai/
export DEPLOYER_PRIVATE_KEY=0x...
npm run deploy:adi
```

**Write contract addresses into `.env`:**

```bash
# After 0G deploy (default chainId 16602)
npm run env:from-broadcast

# Or after ADI deploy
npm run env:from-broadcast 99999
```

This updates root `.env` and copies it to `app/.env`.

---

## 3. Seed demo

From repo root (same RPC and addresses as in `.env`):

```bash
export RPC_URL=https://evmrpc-testnet.0g.ai
# Or leave unset to use RPC_0G from .env

npm run seed:demo
```

Uses `DEPLOYER_PRIVATE_KEY` and `NEXT_PUBLIC_*` (or `ADI_TOKEN`, `HORSE_INFT`, etc.) from `.env`. Mints ADI, 3 horses, lists stallions, mints Breeding Advisor iNFT (token 0).

---

## 4. Run server and app

**Terminal 1 – server (port 4000):**

```bash
cd server && npm i && npm run dev
```

Loads `.env` from repo root. Needed for “Refresh from 0G” and uploads.

**Terminal 2 – app (port 3000):**

```bash
cd app && npm i && npm run dev
```

Ensure `app/.env` exists (synced by `npm run env:from-broadcast`, or copy manually from root `.env`).

Open **http://localhost:3000**.

---

## 5. Networks (MetaMask)

Add and use:

- **0G Galileo Testnet**  
  - Chain ID: **16602**  
  - RPC: `https://evmrpc-testnet.0g.ai`
- **ADI AB Testnet** (if you use ADI)  
  - Chain ID: **99999**  
  - RPC: `https://rpc.ab.testnet.adifoundation.ai/`

Fund the deployer wallet with testnet ETH on the network you deploy to.

---

## 6. Event-Driven Valuation Pipeline (Admin)

After the server and app are running (steps 4):

1. Open **http://localhost:3000/admin** and connect your wallet.
2. Scroll to the **"Simulate + Revalue (Agent)"** panel.
3. Enter a **Horse token ID** (e.g. `0` if you seeded).
4. Select an event type (Race Result / Injury / News) and fill in params.
5. Click **"Simulate + Revalue (Server Oracle)"**.
6. The panel will show: event hash, previous/new valuation, multiplier, tx hash, and explanation.
7. (Optional) Check "Upload to 0G Storage" before clicking — the result panel will include a 0G root hash link.

**Smoke test from CLI** (no browser needed):

```bash
npx tsx scripts/simulate-event.ts
```

This calls the server endpoints and prints the pipeline result.

> **Note:** The server uses `ORACLE_PRIVATE_KEY` (or `DEPLOYER_PRIVATE_KEY`) to submit the `commitValuation` tx. Make sure one of these is set in `.env`.

---

## Checklist

- [ ] `.env` at repo root with `DEPLOYER_PRIVATE_KEY`, `NEXT_PUBLIC_WALLETCONNECT_ID`, app/server URLs
- [ ] `cd contracts && forge build`
- [ ] Deploy: `RPC_0G=... DEPLOYER_PRIVATE_KEY=0x... npm run deploy:og`
- [ ] Addresses in env: `npm run env:from-broadcast`
- [ ] Seed: `npm run seed:demo`
- [ ] Server: `cd server && npm i && npm run dev`
- [ ] App: `cd app && npm i && npm run dev`
- [ ] MetaMask: 0G Galileo (16602) and deployer funded
- [ ] App loads at http://localhost:3000, wallet connects, marketplace/portfolio and breeding work
- [ ] Agent page “Refresh from 0G” works when server is running

---

## Troubleshooting

**400 Bad Request on `/_next/static/css/...` or `/_next/static/chunks/...`**

- The page was loaded from an **old build** (or cached HTML). The browser is asking for CSS/JS files whose hashes no longer exist. Fix: stop the app, clear build output, then start dev and hard-refresh the page:
  ```bash
  cd app && npm run dev:clean
  ```
  Then open http://localhost:3000 and do a **hard refresh** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) so the browser fetches the new HTML and asset URLs. In Chrome DevTools → Network, check **Disable cache** while testing so old asset URLs aren’t reused. A **favicon.ico** 404 is harmless; you can add `public/favicon.ico` later if you want.

**ChunkLoadError / 500 on `/_next/static/chunks/...`**

- Stop any process on port 3000, then run the app in **dev** mode so chunk hashes stay in sync:
  ```bash
  cd app && rm -rf .next && npm run dev
  ```
- If you use production (`npm run build && npm run start`), always run `rm -rf .next && npm run build` before `npm run start`, and use the same build for the running server (no stale `.next`).

**WalletConnect 403 / 400 (api.web3modal.org, pulse.walletconnect.org)**

- The project ID must be **exactly 32 characters**. Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com).
- In `.env`, set `NEXT_PUBLIC_WALLETCONNECT_ID` to your 32-char ID, or leave it empty to use the built-in fallback (connect may have limits).
- After changing env or `providers.tsx`, rebuild: `cd app && rm -rf .next && npm run dev` (or `npm run build` for production).
