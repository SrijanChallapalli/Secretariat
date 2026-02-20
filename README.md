# Secretariat — Decentralized Thoroughbred RWA Marketplace

One codebase, dual deployment: **0G Galileo Testnet** (demo) and **ADI AB Testnet** (institutional). Tokenize horses, fractional ownership, breeding rights market, and an on-chain Breeding Advisor agent (ERC-7857-style iNFT) with 0G Storage model bundle.

## Quickstart

```bash
git clone <repo-url> && cd Secretariat
npm run setup          # copies .env, installs deps, prints next steps
```

Then fill in the two required values in `.env`:

| Variable | Where to get it |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | Export from a testnet wallet (needs gas on 0G / ADI) |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | Create a project at [cloud.walletconnect.com](https://cloud.walletconnect.com) |

Start developing:

```bash
npm run dev            # starts server (:4000) + app (:3000)
```

After deploying contracts, auto-fill addresses:

```bash
npm run deploy:og              # deploy to 0G Galileo
npm run env:from-broadcast     # writes NEXT_PUBLIC_* addresses into .env
```

### Prerequisites

| Tool | Version | Required |
|---|---|---|
| Node.js | >= 18 (20 LTS recommended) | Yes |
| npm | >= 9 | Yes |
| Foundry (forge) | latest | Only for contract dev |

Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`

> **Full step-by-step guide:** see [SETUP.md](./SETUP.md) (deploy, seed, MetaMask config, oracle pipeline).

## Built with

- [0G Storage](https://0g.network) — Decentralized storage for agent model bundles
- [ADI Chain](https://adifoundation.ai) — Institutional-grade EVM network
- [WalletConnect](https://walletconnect.com) — Multi-chain wallet connection
- [RainbowKit](https://rainbowkit.com) — Wallet connection UI

## Repo layout

```
contracts/   Foundry + OpenZeppelin smart contracts
app/         Next.js frontend (TypeScript, Tailwind, wagmi, RainbowKit)
server/      Express API (0G Storage, oracle pipeline, valuation engine)
shared/      Dependency-free TypeScript types & utils
scripts/     Deploy, seed, and utility scripts
```

## Available commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time setup (env, deps, tooling check) |
| `npm run dev` | Start server + app concurrently |
| `npm run dev:app` | Start Next.js app only |
| `npm run dev:server` | Start Express server only |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format with Prettier |
| `npm run check` | Full quality gate (build + forge) |
| `npm run deploy:og` | Deploy contracts to 0G Galileo |
| `npm run deploy:adi` | Deploy contracts to ADI Testnet |
| `npm run env:from-broadcast` | Auto-fill contract addresses from deploy |
| `npm run seed:demo` | Mint horses, list stallions, create agent iNFT |
| `npm run precommit` | Check staged files for leaked secrets |

A `Makefile` is also provided (`make setup`, `make dev`, etc.) for convenience on Mac/Linux.

## Environment variables

All variables are defined in [`.env.example`](.env.example). Copy it to `.env` via `npm run setup`.

### Network RPCs

| Variable | Default | Description |
|---|---|---|
| `RPC_0G` | `https://evmrpc-testnet.0g.ai` | 0G Galileo Testnet RPC |
| `RPC_ADI` | `https://rpc.ab.testnet.adifoundation.ai/` | ADI AB Testnet RPC |
| `CHAIN_ID_0G` | `16602` | 0G chain ID |
| `CHAIN_ID_ADI` | `99999` | ADI chain ID |

### Private keys

| Variable | Required | Description |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | **Yes** | Testnet deployer wallet (needs gas) |
| `ORACLE_PRIVATE_KEY` | No | Oracle pipeline; falls back to `DEPLOYER_PRIVATE_KEY` |
| `OG_UPLOADER_PRIVATE_KEY` | No | 0G Storage uploader; only for model bundle uploads |

### 0G Decentralized Storage

| Variable | Default | Description |
|---|---|---|
| `INDEXER_RPC` | `https://indexer-storage-testnet-turbo.0g.ai` | 0G indexer endpoint |
| `RPC_URL_0G` | `https://evmrpc-testnet.0g.ai` | 0G RPC for storage SDK |

### Contract addresses

Auto-filled by `npm run env:from-broadcast` after deploy. Leave empty until then.

`NEXT_PUBLIC_ADI_TOKEN`, `NEXT_PUBLIC_HORSE_INFT`, `NEXT_PUBLIC_BREEDING_MARKETPLACE`, `NEXT_PUBLIC_SYNDICATE_VAULT`, `NEXT_PUBLIC_HORSE_ORACLE`, `NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY`, `NEXT_PUBLIC_AGENT_INFT`, `NEXT_PUBLIC_AGENT_EXECUTOR`

### App / Frontend

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_ID` | — | 32-char project ID from [WalletConnect Cloud](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL of the Next.js app |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:4000` | Public URL of the Express API |
| `PORT` | `4000` | Express server port |

## Networks

| Mode | Chain | Chain ID | RPC |
|---|---|---|---|
| 0G Demo | 0G Galileo Testnet | 16602 | https://evmrpc-testnet.0g.ai |
| ADI Institutional | ADI AB Testnet | 99999 | https://rpc.ab.testnet.adifoundation.ai/ |

MetaMask: add both networks; switch via RainbowKit/header ("0G Demo" / "ADI Institutional").

## Contracts (short)

- **MockADI** — ERC20 "ADI Token (Demo)"; mintable by deployer.
- **HorseINFT** — ERC-7857-style: mint(to, encryptedURI, metadataHash, horseData), authorizeUsage, transferWithProof (MockINFTOracle).
- **BreedingMarketplace** — list(stallionId, studFee, maxUses, useAllowlist); purchaseBreedingRight(stallionId, seed); breed(stallionId, mareId, offspringName, salt). Deterministic genetics (seed/salt).
- **HorseSyndicateVault** — Per-horse ERC20 shares; buyShares; depositRevenue; claim pro-rata.
- **HorseOracle** — reportRaceResult, reportInjury, reportNews (ORACLE_ROLE); updates HorseINFT valuation.
- **BreedingAdvisorINFT** — Agent iNFT with profile (name, version, specialization, modelBundleRootHash). Token 0: Breeding Advisor. Horse Valuation Agent is off-chain (see `app/lib/horse-valuation-agent.ts`, `server/bundle/valuation-agent/`); when oracle reports race/injury/news, call `POST /valuation/calculate` for agent-suggested USD value.
- **AgentExecutor** — EIP-712 BreedingPlan; execute(plan, offspringName, salt, purchaseSeed, signature) enforces budget/rights and calls marketplace.

## 0G Storage

- **Upload:** App or server builds a model bundle (dataset.json, weights.json, model_card.md, evaluation.json, agent_code.ts or valuation_agent_code.ts) >=10MB (pad if needed), POST to `/og/upload` -> returns `rootHash`, `txHash`. Store `rootHash` in agent iNFT (mint or updateModelBundle). Bundles: `server/bundle/` (Breeding Advisor), `server/bundle/valuation-agent/` (Horse Valuation Agent).
- **Download:** GET `/og/download/:rootHash` streams file. "Refresh from 0G" in UI uses this to show bundle version/contents.

## Agent guardrails

- **Recommend-only (default):** UI runs scoring locally; shows Top 3 + explainability; no on-chain execution. Breeding Advisor uses `/breed?advisor=1`.
- **Execute with approval:** User signs EIP-712 BreedingPlan (budget, maxStudFee, mare, chosenStallion, deadline, traitFloor). AgentExecutor checks signature and constraints, then purchaseBreedingRight (if needed) + breed.

## 5-minute judge demo script

1. **Network:** Switch to "0G Demo" (16602).
2. **Owner wallet:** Show Portfolio -> ADI balance; Marketplace -> horses 0, 1, 2 (minted by seed). Open Horse #0 -> "List breeding rights" (already listed); show stud fee.
3. **Buyer wallet:** Connect second wallet. Marketplace -> Horse #0 -> "Purchase breeding right" (approve ADI, then purchase). Portfolio -> "Get top 3 breeding picks" -> Agent page -> "Get top 3 breeding picks" -> see recommendations; optionally enable "Execute with approval", sign plan, execute -> offspring minted.
4. **0G:** Agent page -> show agent iNFT and model bundle rootHash; "Refresh from 0G" / Download bundle by rootHash (server must be running).
5. **ADI:** Switch network to "ADI Institutional" (99999). Same UI; same flow (use addresses deployed on ADI). Optional: show allowlist on breeding list for institutional mode.

## Common issues

| Problem | Fix |
|---|---|
| `npm run dev` fails with "env validation" | Fill in required vars in `.env` (see above) |
| Contract addresses are `0x000...` | Run `npm run deploy:og` then `npm run env:from-broadcast` |
| WalletConnect modal empty | Set `NEXT_PUBLIC_WALLETCONNECT_ID` (32 chars) |
| `forge: command not found` | Install Foundry: `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Port 4000 already in use | Change `PORT` in `.env` or kill the existing process |

## License

MIT.
