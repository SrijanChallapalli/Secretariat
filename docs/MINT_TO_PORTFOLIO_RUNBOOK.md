# Mint → Portfolio Runbook

If a minted horse does not appear in the Portfolio UI, Transfers & Mints (LiveFeed), or elsewhere, use this checklist.

## 0. Restart dev after deploy (critical for local)

**Restart the dev server after `deploy:local`.** The `deploy:local` script updates `.env` with new contract addresses. Next.js reads `NEXT_PUBLIC_*` vars at startup. If the dev server was running before deploy, it will use stale addresses and query the wrong (or empty) contracts.

```bash
# After deploy:local and seed:local
npm run dev   # or restart if already running
```

Ensure `npm run sync-env` copies root `.env` to `app/.env` (this runs automatically with `npm run dev`).

## 1. Check chain/network

Portfolio and breed must use the same chainId. Verify in the Header or TerminalLayout that you are on the expected network (e.g. Anvil Local 31337, 0G Galileo 16602).

## 2. Check wallet

Ensure the same address used for breeding is connected when viewing the portfolio. Addresses are compared in lowercase; checksum differences should not matter.

## 3. Check tokenId range

Portfolio scans horses with IDs `0..MAX_HORSE_ID_TO_FETCH - 1` (default 0–99). If `totalMinted > 100`, increase `MAX_HORSE_ID_TO_FETCH` in [app/lib/on-chain-horses.ts](../app/lib/on-chain-horses.ts).

## 4. Check cache

After breed success, `queryClient.invalidateQueries()` runs. If the horse still does not appear, add a log in the breed page `onSuccess` to confirm invalidation runs.

## 5. Check RPC

Enable `NEXT_PUBLIC_DEBUG_MINT_TRACE=true` in `.env.local`. Open the browser console and confirm `[MintTrace]` logs show `existingHorseIds` including the new ID after refetch.

## 6. Check Refresh

Click **Refresh** on the Portfolio page. The handler awaits `refetchHorses()` before `refetchOwnership()` to avoid a race.

## 7. Check Bred event

Decode the transaction logs from the breed tx hash. Confirm the `Bred` event has the correct `offspringId` and that the Transfer event shows the correct owner (`to`).

## If minted horse still does not appear

- **Restart dev after deploy:** `deploy:local` updates `.env`. Restart `npm run dev` so the app loads new contract addresses.
- **Check network:** Wallet must be on Anvil Local (31337) when using local deploy.
- **Check LiveFeed (Transfers & Mints):** Scroll to the "Transfers & Mints" section; it polls every 5s. Wait up to 5s or refresh the page. A `secretariat-horse-minted` event triggers an immediate poll when breed succeeds.
- **Check Portfolio:** Click **Refresh**; if "Minted, syncing..." appears, wait for auto-refresh or click Refresh again.

## Flow summary

```
Breed (breed/page) → tx confirmed → parse Bred event → offspringId
→ sessionStorage + invalidateQueries + dispatch secretariat-horse-minted
→ LiveFeed: immediate poll on event; Portfolio: navigate to /portfolio?minted=X
→ Portfolio reads mintedId → "Minted, syncing..." if not yet in myHorses
→ Poll refetch every 2s (max 5) → fallback: direct getHorseData+ownerOf if ID ≥ 100
```
